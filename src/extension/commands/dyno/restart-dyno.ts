import { Dyno } from '@heroku-cli/schema';
import vscode from 'vscode';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import { createHerokuSDK } from '../../utils/heroku-sdk';

@herokuCommand()
/**
 * The RestartDynoCommand is used to restart
 * the specified Dyno.
 */
export class RestartDynoCommand extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:dyno:restart' as const;

  /**
   * Restarts the Dyno after verifying the action
   * with the user.
   *
   * @param dyno The Dyno object representing the Dyno to restart.
   * @returns void
   */
  public async run(dyno: Dyno): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      `This action will restart the ${dyno.name} dyno`,
      { modal: true, detail: 'This action may interrupt traffic to your Dyno' },
      'Restart'
    );
    if (confirmation !== 'Restart') {
      return;
    }

    try {
      const { platform } = await createHerokuSDK(this.signal, undefined, ['dynoExtensions']);
      vscode.window.setStatusBarMessage(`${dyno.name} is restarting...`, 4000);
      // The resource explorer's view/item/context only shows the
      // restart action when viewItem === heroku:dyno:(up|down|crashed),
      // so the platform shouldn't see this on a starting/restarting
      // dyno from the inline path. Matches `heroku ps:restart`.
      await platform.dyno.restart(dyno.app.id as string, { dyno: dyno.name });
    } catch (e) {
      await vscode.window.showErrorMessage(`Could not restart ${dyno.name}.`);
    }
  }

  /**
   * Aborts any pending actions including API requests.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
