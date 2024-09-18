import { AddOn } from '@heroku-cli/schema';
import AddOnService from '@heroku-cli/schema/services/add-on-service.js';
import vscode, { AuthenticationSession } from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand } from '../../meta/command';

@herokuCommand()
/**
 * Polls the state of an add-on
 */
export class PollAddOnState extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:addons:poll-status' as const;
  protected addonService = new AddOnService(fetch, 'https://api.heroku.com');

  /**
   * Runs the command with the given add-on and poll state.
   *
   * @param addOn The add-on to poll the state for.
   * @param pollUntil the state to poll until.
   * @param timeout the timeout in milliseconds. Default is 240,000
   * @returns void
   */
  public async run(
    addOn: AddOn,
    pollUntil: AddOn['state'] = 'provisioned',
    timeout: number = 240 * 1000
  ): Promise<void> {
    const { accessToken } = (await vscode.authentication.getSession('heroku:auth:login', [])) as AuthenticationSession;
    const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    const start = Date.now();
    while (!this.signal.aborted) {
      const response = await this.addonService.info(addOn.id, requestInit);
      Reflect.set(addOn, 'state', response.state);
      if (response.state === pollUntil) {
        break;
      }
      if (Date.now() - start > timeout) {
        this.abort();
      } else {
        // Wait for 2 seconds before polling again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}
