import { Dyno } from '@heroku-cli/schema';
import DynoService from '@heroku-cli/schema/services/dyno-service.js';
import vscode from 'vscode';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import { generateRequestInit } from '../../utils/generate-service-request-init';

@herokuCommand()
/**
 * The RestartDynoCommand is used to restart
 * the specified Dyno.
 */
export class RestartDynoCommand extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:dyno:restart' as const;
  protected dynoService = new DynoService(fetch, 'https://api.heroku.com');

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
    const requestInit = await generateRequestInit(this.signal);

    try {
      const { state } = await this.dynoService.info(dyno.app.id as string, dyno.name, requestInit);
      if (state !== 'starting') {
        const disposable = vscode.window.setStatusBarMessage(`${dyno.name} is restarting...`);
        setTimeout(() => {
          disposable.dispose();
        }, 4000);
        await this.dynoService.restart(dyno.app.id as string, dyno.name, requestInit);
      }
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
