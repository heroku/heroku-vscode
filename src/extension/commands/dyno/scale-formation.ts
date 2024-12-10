import FormationService from '@heroku-cli/schema/services/formation-service.js';
import { Formation } from '@heroku-cli/schema';
import vscode, { EventEmitter } from 'vscode';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import { generateRequestInit } from '../../utils/generate-service-request-init';

@herokuCommand()
/**
 * The ScaleFormationCommand is used to scale a formation
 */
export class ScaleFormationCommand extends AbortController implements RunnableCommand<Promise<void>> {
  public static COMMAND_ID = 'heroku:scale-formation' as const;

  protected formationService = new FormationService(fetch, 'https://api.heroku.com');
  private cancellationToken = new EventEmitter();

  /**
   * Performs the scale operation to the formation
   * and returns the new formation.
   *
   * @param formation The formation to scale.
   * @param quantity The quantity to scale to. If omitted, the user is prompted for input.
   */
  public async run(formation: Formation, quantity?: number): Promise<void> {
    const payload = { quantity };
    if (quantity === undefined) {
      const userInput = await vscode.window.showInputBox(
        {
          title: 'Change Dyno count',
          prompt: 'Set the number of dynos to use for this process.',
          value: formation.quantity.toString(),
          validateInput(value): string | undefined {
            const val = parseInt(value, 10);
            if (isNaN(val)) {
              return 'A number between 0 and 100 must be provided';
            }
            if (val > 100) {
              return `${val} exceeds the maximum value of 100`;
            }
            return undefined;
          }
        },
        { isCancellationRequested: false, onCancellationRequested: this.cancellationToken.event }
      );

      if (userInput) {
        payload.quantity = parseInt(userInput, 10);
      } else {
        return;
      }
    }

    const requestInit = await generateRequestInit(this.signal);

    try {
      const updatedFormation = await this.formationService.update(
        formation.app.id as string,
        formation.id,
        payload,
        requestInit
      );
      Object.assign(formation, updatedFormation);
    } catch {
      await vscode.window.showErrorMessage(`Could not scale the formation for the ${formation.app.name} app.`);
    }
  }

  /**
   * Releases resources including canceling any pending api requests.
   */
  public [Symbol.dispose](): void {
    this.abort();
    this.cancellationToken.fire(null);
  }
}
