import { randomUUID } from 'node:crypto';
import type { FileChangeInfo } from 'node:fs/promises';
import vscode from 'vscode';
import { LoginCommand } from '../commands/auth/login';
import { TokenCommand } from '../commands/auth/token';
import { WhoAmI } from '../commands/auth/whoami';
import { disposify } from '../utils/disposify';
import { LogoutCommand } from '../commands/auth/logout';
import { WatchNetrc } from '../commands/auth/watch-netrc';
import { HerokuCommandCompletionInfo } from '../commands/heroku-command';

export class AuthenticationProvider
  extends vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>
  implements vscode.AuthenticationProvider
{
  private static SESSION_KEY = 'heroku.session' as const;
  public onDidChangeSessions = this.event;
  private netRcAbortController: AbortController | undefined;
  private outputChannel = vscode.window.createOutputChannel('Heroku auth');

  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
    this.watchNetrc();
  }

  public async getSessions(scopes?: readonly string[] | undefined): Promise<readonly vscode.AuthenticationSession[]> {
    const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
    let accessToken: string | undefined;
    let whoami: string | undefined;

    if (sessionJson) {
      const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
      accessToken = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
      if (accessToken !== session.accessToken) {
        await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
        return [];
      }
      whoami = session.account.label;
    }

    if (!accessToken || !whoami) {
      ([accessToken, whoami] = await Promise.all([
        vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID),
        vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID)
      ]));
    }

    if (!accessToken || !whoami) {
      await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
      return [];
    }
    const session: vscode.AuthenticationSession = this.createSessionObject(whoami, accessToken, scopes ?? []);
    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    vscode.commands.executeCommand('setContext', 'heroku.authenticated', true);
    return [session];
  }

  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    this.netRcAbortController?.abort();
    const {errorMessage, exitCode} = await vscode.commands.executeCommand<HerokuCommandCompletionInfo>(LoginCommand.COMMAND_ID, this.outputChannel);

    const [accessToken, whoami] = await Promise.all([
      vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID, this.outputChannel),
      vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID, this.outputChannel)
    ]);

    if (exitCode !== 0) {
      throw new Error(errorMessage);
    }

    const session = this.createSessionObject(whoami, accessToken, scopes);

    this.fire({ added: [session], removed: undefined, changed: undefined });
    await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
    void this.watchNetrc();

    vscode.commands.executeCommand('setContext', 'heroku.authenticated', true);

    return session;
  }

  public async removeSession(sessionId: string): Promise<void> {
    this.netRcAbortController?.abort();
    await vscode.commands.executeCommand<string>(LogoutCommand.COMMAND_ID, this.outputChannel);
    const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
    if (sessionJson) {
      const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
      if (session.id === sessionId) {
        await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
        this.fire({ added: undefined, removed: [session], changed: undefined });
      }
    }
    void this.watchNetrc();
    vscode.commands.executeCommand('setContext', 'heroku.authenticated', false);
  }

  public async dispose(): Promise<void> {
    await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
    this.netRcAbortController?.abort();
    super.dispose();
  }

  private async watchNetrc(): Promise<void> {
    this.netRcAbortController = new AbortController();
    const watcher = await vscode.commands.executeCommand<AsyncIterable<FileChangeInfo<string>>>(WatchNetrc.COMMAND_ID, undefined, this.netRcAbortController.signal);
    try {
      for await (const event of watcher) {
        const accessToken = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
        if (!accessToken) {
          const sessionJson = await this.context.secrets.get(AuthenticationProvider.SESSION_KEY);
          if (sessionJson) {
            const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
            await this.context.secrets.delete(AuthenticationProvider.SESSION_KEY);
            this.fire({ added: undefined, removed: [session], changed: undefined });
            this.outputChannel.appendLine(`${session.account.label} signed out of Heroku`);
            vscode.commands.executeCommand('setContext', 'heroku.authenticated', false);
          }
        } else {
          const whoami = await vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID);
          const session = this.createSessionObject(whoami, accessToken, []);
          this.fire({ added: [session], removed: undefined, changed: undefined });
          this.outputChannel.appendLine(`Logged in to Heroku as ${whoami}`);
          await this.context.secrets.store(AuthenticationProvider.SESSION_KEY, JSON.stringify(session));
          vscode.commands.executeCommand('setContext', 'heroku.authenticated', true);
        }
      }
    } catch {
        // no-op
    }
  }

  private createSessionObject(whoami: string, accessToken: string, scopes: readonly string[]): vscode.AuthenticationSession {
    return {
      account: {
        id: 'Heroku',
        label: whoami
      },
      id: randomUUID(),
      scopes,
      accessToken
    };
  }
}
