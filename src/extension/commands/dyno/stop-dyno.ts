import { Dyno } from "@heroku-cli/schema";
import vscode, { AuthenticationSession } from "vscode";
import FormationService from "@heroku-cli/schema/services/formation-service.js";
import { herokuCommand, RunnableCommand } from "../../meta/command";

@herokuCommand()
/**
 * The StopDynoCommand stops a Dyno by
 * horizontally scaling it down to zero.
 */
export class StopDynoCommand extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:dyno:stop' as const;
  protected formationService = new FormationService(fetch, 'https://api.heroku.com');

  /**
   *
   * @param dyno The Dyno to scale down to zero.
   * @returns void
   */
  public async run(dyno: Dyno): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(`This action will scale the ${dyno.name} dyno to zero.`, {modal: true}, 'Stop Dyno');
    if (confirmation !== 'Stop Dyno') {
      return;
    }
    vscode.window.setStatusBarMessage(`${dyno.name} is stopping...`);
    const { accessToken } = await vscode.authentication.getSession('heroku:auth:login', []) as AuthenticationSession;
    const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    try {
      const formations = await this.formationService.list(dyno.app.id as string, requestInit);
      formations.forEach(formation => Reflect.set(formation, 'size', '0'));

      await this.formationService.batchUpdate(dyno.app.id as string, {updates: formations});
      Reflect.set(dyno, 'state', 'down');
      vscode.window.setStatusBarMessage(`${dyno.name} was stopped successfully`);
    } catch {
      await vscode.window.showErrorMessage(`Could not stop ${dyno.name}.`);
    }
  }

  /**
   * Aborts any pending API requests.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
