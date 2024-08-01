import { Dyno } from "@heroku-cli/schema";
import DynoService from "@heroku-cli/schema/services/dyno-service.js";
import vscode, { AuthenticationSession } from "vscode";
import { herokuCommand, RunnableCommand } from "../../meta/command";

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
   * @returns void
   */
  public async run(dyno: Dyno): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(`This action will restart the ${dyno.name} dyno`, {modal: true, detail:'This action may interupt traffic to your Dyno'}, 'Cancel', 'Restart');
    if (confirmation !== 'Restart') {
      return;
    }

    const { accessToken } = await vscode.authentication.getSession('heroku:auth:login', []) as AuthenticationSession;
    const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    try {
      const { state } = await this.dynoService.info(dyno.app.id as string, dyno.id, requestInit);
      if (state !== 'starting') {
        await this.dynoService.restart(dyno.app.id as string, dyno.id, requestInit);
      }
      vscode.window.setStatusBarMessage(`${dyno.name} is restarting...`);
    } catch {
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
