import vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand } from '../../meta/command';

@herokuCommand
export class WelcomeViewSignIn extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:welcome:signin';

  public async run(): Promise<void> {
    try {
      const session = await vscode.authentication.getSession('heroku:auth:login', [], { createIfNone: true });
      if (session?.accessToken) {
        this.outputChannel?.appendLine('Authenticaton successful');
        await vscode.window.showInformationMessage(`Logged in as ${session?.account.label}`);
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
