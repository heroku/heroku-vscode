import vscode, { EventEmitter } from 'vscode';
import { AuthCompletionInfo, LoginCommand } from '../commands/auth/login';
import { WhoAmI, type WhoAmIResult } from '../commands/auth/whoami';
import { LogoutCommand } from '../commands/auth/logout';
import { createSessionObject } from '../utils/create-session-object';
import { getNetrcFileLocation } from '../utils/netrc-locator';
import { TokenCommand } from '../commands/auth/token';
import { logExtensionEvent } from '../utils/logger';

/**
 * The AuthenticationProvider is used to manage authentication
 * for the Heroku Extension.
 */
export class AuthenticationProvider
  extends EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>
  implements vscode.AuthenticationProvider
{
  public static SESSION_KEY = 'heroku.session' as const;
  public onDidChangeSessions = this.event;
  private getSessionPromise: Promise<vscode.AuthenticationSession[]> | undefined;
  private netrcDisposable: vscode.Disposable | undefined;
  private netrcChangedDebounce: NodeJS.Timeout | undefined;

  /**
   * Constructs a new AuthenticationProvider
   *
   * @param context The ExtensionContext provided by VSCode.
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
    void this.watchNetrc();
  }

  /**
   * @inheritdoc
   */
  public async getSessions(scopes?: readonly string[] | undefined): Promise<vscode.AuthenticationSession[]> {
    // There can be several executions of this function which
    // can duplicate endpoint and command calls.
    this.getSessionPromise ??= (async (): Promise<vscode.AuthenticationSession[]> => {
      const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
      let accessToken: string | undefined;
      let whoami: string | Error | undefined;

      if (sessionJson) {
        const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
        return [session];
      }

      if (!accessToken || !whoami) {
        try {
          const { account, token: gpgToken } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
          whoami = account.email;
          accessToken = gpgToken;
        } catch (error) {
          const { message } = error as Error;
          logExtensionEvent(`Failed to get session: ${message}`);
        }
      }

      if (!accessToken || !whoami) {
        await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
        await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
        logExtensionEvent('No session found');
        return [];
      }
      const session: vscode.AuthenticationSession = createSessionObject(whoami as string, accessToken, scopes ?? []);
      await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
      await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);
      return [session];
    })();

    const result = await this.getSessionPromise;
    // Keep this around for a bit in case vscode needs to call it again
    setTimeout(() => (this.getSessionPromise = undefined), 1000);

    return result;
  }

  /**
   * @inheritdoc
   */
  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const { errorMessage, exitCode } = await vscode.commands.executeCommand<AuthCompletionInfo>(
      LoginCommand.COMMAND_ID
    );

    if (exitCode !== 0) {
      logExtensionEvent(`Authentication failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    let session: vscode.AuthenticationSession | undefined;
    try {
      const { account, token: accessToken } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
      session = createSessionObject(account.email, accessToken, scopes);
    } catch (error) {
      const { message } = error as Error;
      await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
      const eventMessage = `Failed to log in to Heroku: ${message}`;
      logExtensionEvent(eventMessage);
      throw new Error(eventMessage);
    }

    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);

    logExtensionEvent(`${session.account.label} logged in`);

    return session;
  }

  /**
   * @inheritdoc
   */
  public async removeSession(sessionId: string): Promise<void> {
    await vscode.commands.executeCommand<string>(LogoutCommand.COMMAND_ID);
    const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
    if (sessionJson) {
      const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
      if (session.id === sessionId) {
        await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
        this.fire({ added: undefined, removed: [session], changed: undefined });
      }
    }
    await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
  }

  /**
   * @inheritdoc
   */
  public async dispose(): Promise<void> {
    await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
    this.netrcDisposable?.dispose();
    super.dispose();
  }

  /**
   * Watches the .netrc for changes that may
   * affect the authentication state of the
   * Heroku Extension. This generally happens
   * when the user uses a separate terminal to
   * authenticate or sign out.
   *
   * This watcher allows the Extension to maintain
   * synchronicity with the auth state of the Heroku CLI.
   *
   * @returns boolean indicating if a netrc file was found
   */
  private async watchNetrc(): Promise<boolean> {
    this.netrcDisposable?.dispose();
    const file = await getNetrcFileLocation();
    const uri = vscode.Uri.file(file);
    // Determine if we have a netrc file to watch
    // if not, let's poll every 3 seconds
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (await this.watchNetrc()) {
        this.onNetrcChanged();
        return true;
      }
      return false;
    }

    const netrcWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(uri, '*'));
    this.netrcDisposable = netrcWatcher.onDidChange(this.onNetrcChanged);
    return true;
  }

  /**
   * Change handler for the netrc file.
   * This function maintains sync with the netrc
   * state which is used by the Heroku CLI for auth.
   */
  private onNetrcChanged = (): void => {
    if (this.netrcChangedDebounce) {
      clearTimeout(this.netrcChangedDebounce);
    }
    this.netrcChangedDebounce = setTimeout(() => void this.updateSessionState(), 2000);
  };

  /**
   * Updates the session state based on the current
   * state of the Heroku CLI.
   */
  private async updateSessionState(): Promise<void> {
    const accessToken = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    if (!accessToken) {
      const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
      if (sessionJson) {
        await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
        const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
        await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
        logExtensionEvent(`${session.account.label} signed out of Heroku externally`);
        this.fire({ added: undefined, removed: [session], changed: undefined });
      }
    } else {
      const { account } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
      const session = createSessionObject(account.email, accessToken, []);
      await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
      await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);
      logExtensionEvent(`Externally logged in to Heroku as ${account.email}`);
      this.fire({ added: [session], removed: undefined, changed: undefined });
    }
  }
}
