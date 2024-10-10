import type { AddOn } from '@heroku-cli/schema';
import AddOnService from '@heroku-cli/schema/services/add-on-service.js';
import * as vscode from 'vscode';
import { herokuCommand, type RunnableCommand } from '../../meta/command';

@herokuCommand()
/**
 * List add-ons by app
 */
export class ListAddOnsByApp extends AbortController implements RunnableCommand<AddOn[]> {
  public static COMMAND_ID = 'heroku:addons:list-by-app' as const;
  private static debounceRequestsbyApp = new Map<string, Promise<AddOn[]>>();

  protected addOnService = new AddOnService(fetch, 'https://api.heroku.com');

  /**
   * Constructs a new instance of the ListAddOnsByApp class
   *
   * @param appIdentifier The id of the app to retrieve add-ons for
   * @param debounce Whether to debounce the request
   * @returns Promise<AddOn[]>
   */
  public async run(appIdentifier: string, debounce = true): Promise<AddOn[]> {
    let request = ListAddOnsByApp.debounceRequestsbyApp.get(appIdentifier);
    if (!request || !debounce) {
      const { accessToken } = (await vscode.authentication.getSession(
        'heroku:auth:login',
        []
      )) as vscode.AuthenticationSession;
      const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };
      request = this.addOnService.listByApp(appIdentifier, requestInit);
    }
    if (debounce) {
      ListAddOnsByApp.debounceRequestsbyApp.set(appIdentifier, request);
    }
    const addOns = await request;
    ListAddOnsByApp.debounceRequestsbyApp.delete(appIdentifier);

    return addOns;
  }

  /**
   * Dispose of the abort controller
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
