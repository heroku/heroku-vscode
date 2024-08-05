import vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';

@herokuCommand({
  outputChannelId: HerokuOutputChannel.Authentication
})
/**
 * The WelcomeViewSignIn command is executed when the
 * user uses the "Sign in" button on the welcome screen.
 */
export class WelcomeViewSignIn extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:welcome:signin';

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
      const session = await vscode.authentication.getSession('heroku:auth:login', [], { createIfNone: true });
      if (session?.accessToken) {
        this.outputChannel?.appendLine(`Successfully authenticated as ${session.account.label}`);
      }
    } catch {
      const affirmative = 'Try again?';
      const action = await vscode.window.showErrorMessage(
        'Authentication was unsucessful. Try again?',
        affirmative,
        'skip'
      );
      if (action === affirmative) {
        return this.run();
      }
    }
  }
}
