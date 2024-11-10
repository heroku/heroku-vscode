import vscode, { EventEmitter } from 'vscode';
import { LoginCommand } from '../commands/auth/login';
import { TokenCommand } from '../commands/auth/token';
import { WhoAmI } from '../commands/auth/whoami';
import { LogoutCommand } from '../commands/auth/logout';
import { WatchNetrc } from '../commands/auth/watch-netrc';
import { HerokuCommandCompletionInfo } from '../commands/heroku-command';
import { HerokuOutputChannel, getOutputChannel } from '../meta/command';
import { createSessionObject } from '../utils/create-session-object';

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
  private netRcAbortController: AbortController | undefined;

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
  public async getSessions(scopes?: readonly string[] | undefined): Promise<readonly vscode.AuthenticationSession[]> {
    const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
    let accessToken: string | undefined;
    let whoami: string | undefined;

    if (sessionJson) {
      const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
      accessToken = session.accessToken;
      whoami = session.account.label;
    }

    if (!accessToken || !whoami) {
      [accessToken, whoami] = await Promise.all([
        vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID),
        vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID)
      ]);
    }

    if (!accessToken || !whoami) {
      await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
      return [];
    }
    const session: vscode.AuthenticationSession = createSessionObject(whoami, accessToken, scopes ?? []);
    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);
    return [session];
  }

  /**
   * @inheritdoc
   */
  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    this.netRcAbortController?.abort();
    const { errorMessage, exitCode } = await vscode.commands.executeCommand<HerokuCommandCompletionInfo>(
      LoginCommand.COMMAND_ID
    );

    const [accessToken, whoami] = await Promise.all([
      vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID),
      vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID)
    ]);

    if (exitCode !== 0) {
      throw new Error(errorMessage);
    }

    const session = createSessionObject(whoami, accessToken, scopes);

    this.fire({ added: [session], removed: undefined, changed: undefined });
    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    void this.watchNetrc();

    await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);

    const outputChannel = getOutputChannel({
      outputChannelId: HerokuOutputChannel.Authentication
    }) as vscode.OutputChannel;
    outputChannel.appendLine(`${session.account.label} logged in`);

    return session;
  }

  /**
   * @inheritdoc
   */
  public async removeSession(sessionId: string): Promise<void> {
    this.netRcAbortController?.abort();
    await vscode.commands.executeCommand<string>(LogoutCommand.COMMAND_ID);
    const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
    if (sessionJson) {
      const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
      if (session.id === sessionId) {
        await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
        this.fire({ added: undefined, removed: [session], changed: undefined });
      }
    }
    void this.watchNetrc();
    await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
  }

  /**
   * @inheritdoc
   */
  public async dispose(): Promise<void> {
    await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
    this.netRcAbortController?.abort();
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
    this.netRcAbortController = new AbortController();
    const netRcChanges = await vscode.commands.executeCommand<
      AsyncIterable<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>
    >(WatchNetrc.COMMAND_ID, this.netRcAbortController.signal, this.context, AuthenticationProvider.SESSION_KEY);
    try {
      for await (const change of netRcChanges) {
        this.fire(change);
      }
    } catch {
      // noop
    }
  }
}
