import vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { LoginCommand } from './login';

@herokuCommand({
  outputChannelId: HerokuOutputChannel.Authentication
})
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
    try {
      const session = await vscode.authentication.getSession(LoginCommand.COMMAND_ID, [], { createIfNone: true });
      if (session?.accessToken) {
        this.outputChannel?.appendLine(`Successfully authenticated as ${session.account.label}`);
      }
    } catch (error) {
      // This means the terminal must be used for auth
      // and a prompt has been initiated.
      if (error instanceof Error && error.message.includes('Auth must be completed in a Terminal')) {
        return;
      }
      const affirmative = 'Retry';
      const action = await vscode.window.showErrorMessage(
        'Authentication was unsucessful. Try again?',
        affirmative,
        'Not now'
      );
      if (action === affirmative) {
        return this.run();
      }
    }
  }
}
