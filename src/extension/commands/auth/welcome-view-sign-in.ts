import { promisify } from 'node:util';
import vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand } from '../../meta/command';
import { logExtensionEvent } from '../../utils/logger';
import { LoginCommand } from './login';

@herokuCommand()
/**
 * The WelcomeViewSignIn command is executed when the
 * user uses the "Sign in" button on the welcome screen.
 */
export class WelcomeViewSignIn extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:welcome:signin' as const;
  /**
   * Attempts to query the session info from the
   * authentication provider or enters into an
   * auth flow if no session is found. This command
   * will ask the user for permission to authenticate
   * as required by VSCode.
   *
   * @returns void
   */
  public async run(): Promise<void> {
    await vscode.window.withProgress(
      {
        title: 'Authenticating with Heroku...',
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (progress, token) => {
        try {
          const cancellationPromise: Promise<void> = promisify(token.onCancellationRequested)();
          const sessionPromise = vscode.authentication.getSession(LoginCommand.COMMAND_ID, [], { createIfNone: true });
          const session = (await Promise.race([sessionPromise, cancellationPromise])) as vscode.AuthenticationSession;

          if (session?.accessToken) {
            logExtensionEvent(`Successfully authenticated as ${session.account.label}`);
          }
        } catch (error) {
          const affirmative = 'Retry';
          const action = await vscode.window.showErrorMessage(
            'Authentication was unsuccessful. Try again?',
            affirmative,
            'Not now'
          );
          if (action === affirmative) {
            progress.report({ increment: 100 });
            return this.run();
          }
        }
        progress.report({ increment: 100 });
      }
    );
    logExtensionEvent('Authenticating with Heroku...');
  }
}
