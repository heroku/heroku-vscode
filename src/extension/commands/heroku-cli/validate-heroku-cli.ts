import vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand } from '../../meta/command';
import { logExtensionEvent } from '../../utils/logger';
@herokuCommand()
/**
 * This command checks if the Heroku CLI is installed on the user's machine.
 * If it is not installed, the user is prompted to install it.
 */
export class ValidateHerokuCLICommand extends HerokuCommand<boolean> {
  public static readonly COMMAND_ID = 'heroku.validateHerokuCLI';

  /**
   * Executes the command to validate the Heroku CLI installation.
   *
   * @returns true if the Heroku CLI is installed, false otherwise.
   */
  public async run(): Promise<boolean> {
    let isInstalled = true;
    try {
      using versionProc = HerokuCommand.exec('heroku --version', {
        env: { ...process.env, HEROKU_HEADERS: await this.getCLIHeaders() }
      });
      const result = await HerokuCommand.waitForCompletion(versionProc);
      isInstalled = result.exitCode === 0;
    } catch (e) {
      isInstalled = false;
    }

    if (!isInstalled) {
      logExtensionEvent(
        'Error: Heroku CLI not found. Visit https://devcenter.heroku.com/articles/heroku-cli to install the Heroku CLI.'
      );
      const items = ['Cancel', 'Install Heroku CLI'];
      const choice = await vscode.window.showWarningMessage(
        'The Heroku CLI is required to use this extension.',
        ...items
      );
      if (choice === items[1]) {
        void vscode.env.openExternal(vscode.Uri.parse('https://devcenter.heroku.com/articles/heroku-cli'));
      }
    }
    return isInstalled;
  }
}
