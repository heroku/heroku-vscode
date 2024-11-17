import vscode, { EventEmitter } from 'vscode';
import { LoginCommand } from '../commands/auth/login';
import { WhoAmI, type WhoAmIResult } from '../commands/auth/whoami';
import { LogoutCommand } from '../commands/auth/logout';
import type { HerokuCommandCompletionInfo } from '../commands/heroku-command';
import { HerokuOutputChannel, getOutputChannel } from '../meta/command';
import { createSessionObject } from '../utils/create-session-object';
import { getNetrcFileLocation } from '../utils/netrc-locator';
import { TokenCommand } from '../commands/auth/token';

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
  private netRcDisposable: vscode.Disposable | undefined;
  private outputChannel = getOutputChannel({
    outputChannelId: HerokuOutputChannel.Authentication
  }) as vscode.OutputChannel;

  /**
   * Constructs a new AuthenticationProvider
   *
   * @param context The ExtensionContext provded by VSCode.
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
    void this.watchNetrc();
  }

  /**
   * @inheritdoc
   */
  public async getSessions(scopes?: readonly string[] | undefined): Promise<vscode.AuthenticationSession[]> {
    const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
    let accessToken: string | undefined;
    let whoami: string | Error | undefined;

    if (sessionJson) {
      const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
      accessToken = session.accessToken;
      whoami = session.account.label;
      this.outputChannel.appendLine(`Using existing session for ${whoami}`);
      return [session];
    }

    if (!accessToken || !whoami) {
      try {
        const { account, token: gpgToken } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
        whoami = account.email;
        accessToken = gpgToken;
      } catch (error) {
        const { message } = error as Error;
        this.outputChannel.appendLine(`Failed to get session: ${message}`);
      }
    }

    if (!accessToken || !whoami) {
      await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
      await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
      this.outputChannel.appendLine('No session found, prompting for login');
      return [];
    }
    const session: vscode.AuthenticationSession = createSessionObject(whoami as string, accessToken, scopes ?? []);
    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);
    this.outputChannel.appendLine(`Created session for ${session.account.label}`);
    return [session];
  }

  /**
   * @inheritdoc
   */
  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const { errorMessage, exitCode } = await vscode.commands.executeCommand<HerokuCommandCompletionInfo>(
      LoginCommand.COMMAND_ID
    );

    if (exitCode !== 0) {
      throw new Error(errorMessage);
    }
    let session: vscode.AuthenticationSession | undefined;
    try {
      const { account, token: accessToken } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
      session = createSessionObject(account.email, accessToken, scopes);
    } catch (error) {
      const { message } = error as Error;
      await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
      throw new Error(`Failed to log in to Heroku: ${message}`);
    }

    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);

    this.outputChannel.appendLine(`${session.account.label} logged in`);

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
    this.netRcDisposable?.dispose();
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
   */
  private async watchNetrc(): Promise<void> {
    const file = await getNetrcFileLocation();
    const uri = vscode.Uri.file(file);

    const netrcWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(uri, '*'));
    const disposable = netrcWatcher.onDidChange(async () => {
      const accessToken = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
      if (!accessToken) {
        const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
        if (sessionJson) {
          await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
          const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
          await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
          this.outputChannel.appendLine(`${session.account.label} signed out of Heroku`);
          this.fire({ added: undefined, removed: [session], changed: undefined });
        }
      } else {
        const { account } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
        const session = createSessionObject(account.email, accessToken, []);
        await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
        await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);
        this.outputChannel.appendLine(`Logged in to Heroku as ${account.email}`);
        this.fire({ added: [session], removed: undefined, changed: undefined });
      }
    });
    this.context.subscriptions.push(disposable);
  }
}
