import { Dyno } from '@heroku-cli/schema';
import DynoService from '@heroku-cli/schema/services/dyno-service.js';
import vscode, { AuthenticationSession } from 'vscode';
import { herokuCommand, RunnableCommand } from '../../meta/command';

@herokuCommand()
/**
 * The RestartDynoCommand is used to retart
 * the specified Syno.
 */
export class RestartDynoCommand extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:dyno:restart' as const;
  protected dynoService = new DynoService(fetch, 'https://api.heroku.com');

  /**
   * Restarts the Dyno after verifying the action
   * with the user.
   *
   * @param dyno The Dyno object represeting the Dyno to restart.
   * @param pollStateOnly Boolean indicating whether to just poll the state of the dyno
   * @returns void
   */
  public async run(dyno: Dyno, pollStateOnly?: boolean): Promise<void> {
    if (!pollStateOnly) {
      const confirmation = await vscode.window.showWarningMessage(
        `This action will restart the ${dyno.name} dyno`,
        { modal: true, detail: 'This action may interupt traffic to your Dyno' },
        'Restart'
      );
      if (confirmation !== 'Restart') {
        return;
      }
    }

    const { accessToken } = (await vscode.authentication.getSession('heroku:auth:login', [])) as AuthenticationSession;
    const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    try {
      let state: string;
      let id: string;
      ({ state } = await this.dynoService.info(dyno.app.id as string, dyno.id, requestInit));
      if (state !== 'starting') {
        const disposable = vscode.window.setStatusBarMessage(`${dyno.name} is restarting...`);
        setTimeout(() => {
          disposable.dispose();
        }, 4000);
        await this.dynoService.restart(dyno.app.id as string, dyno.id, requestInit);
      }

      let retries = 120;
      while (!this.signal.aborted) {
        ({ state, id } = await this.dynoService.info(dyno.app.id as string, dyno.name, requestInit));
        // Remove this message after 4 seconds
        const disposable = vscode.window.setStatusBarMessage(`${dyno.name} is ${state}`);
        setTimeout(() => {
          disposable.dispose();
        }, 4000);
        Reflect.set(dyno, 'state', state);
        Reflect.set(dyno, 'id', id);
        retries--;
        if (!retries || dyno.state === 'up' || dyno.state === 'crashed') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
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
