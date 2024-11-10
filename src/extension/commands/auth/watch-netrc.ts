import { watch } from 'node:fs/promises';
import * as vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { createSessionObject } from '../../utils/create-session-object';
import { getNetrcFileLocation } from '../../utils/netrc-locator';
import { TokenCommand } from './token';
import { WhoAmI } from './whoami';

@herokuCommand({ outputChannelId: HerokuOutputChannel.Authentication })
/**
 * Command that creates a watcher for the .netrc file.
 */
export class WatchNetrc extends HerokuCommand<
  AsyncIterable<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>
> {
  public static COMMAND_ID = 'heroku:watchnetrc' as const;

  /**
   * Create a file watcher for the .netrc file on disk.
   * This watcher is used to detect external changes
   * that occur from signing in or sining out of Heroku
   * outside of the extension. e.g. The user uses a
   * terminal to sign in or out.
   *
   * @param signal The abort signal used to stop the watcher.
   * @param context The extension context used to store and retrieve secrets.
   * @param sessionKey The key used to read and store the session.
   * @returns a Promise that resolves to an AsyncIterable which will contain file change info on each await.
   */
  public async run(
    signal: AbortSignal,
    context: vscode.ExtensionContext,
    sessionKey: string
  ): Promise<AsyncIterable<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>> {
    const file = await getNetrcFileLocation();
    const iterator = watch(file, { signal });
    const outputChannel = this.outputChannel as vscode.OutputChannel;

    return (async function* (): AsyncGenerator<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> {
      for await (const event of iterator) {
        if (event.eventType !== 'change') {
          continue;
        }
        const accessToken = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
        if (!accessToken) {
          const sessionJson = await context.secrets.get(sessionKey);
          if (sessionJson) {
            await context.secrets.delete(sessionKey);
            const session = JSON.parse(sessionJson) as vscode.AuthenticationSession;
            await vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
            outputChannel.appendLine(`${session.account.label} signed out of Heroku`);
            yield { added: undefined, removed: [session], changed: undefined };
          }
        } else {
          const whoami = await vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID);
          const session = createSessionObject(whoami, accessToken, []);
          await context.secrets.store(sessionKey, JSON.stringify(session));
          await vscode.commands.executeCommand('setContext', 'heroku:login:required', false);
          outputChannel.appendLine(`Logged in to Heroku as ${whoami}`);
          yield { added: [session], removed: undefined, changed: undefined };
        }
      }
    })();
  }
}
