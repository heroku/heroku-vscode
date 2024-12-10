import type { AddOn } from '@heroku-cli/schema';
import AddOnService from '@heroku-cli/schema/services/add-on-service.js';
import { herokuCommand, type RunnableCommand } from '../../meta/command';
import { generateRequestInit } from '../../utils/generate-service-request-init';

@herokuCommand()
/**
 * List add-ons by app
 */
export class ListAddOnsByApp extends AbortController implements RunnableCommand<AddOn[]> {
  public static COMMAND_ID = 'heroku:addons:list-by-app' as const;
  private static debounceRequestsByApp = new Map<string, Promise<AddOn[]>>();

  protected addOnService = new AddOnService(fetch, 'https://api.heroku.com');

  /**
   * Constructs a new instance of the ListAddOnsByApp class
   *
   * @param appIdentifier The id of the app to retrieve add-ons for
   * @param debounce Whether to debounce the request
   * @returns Promise<AddOn[]>
   */
  public async run(appIdentifier: string, debounce = true): Promise<AddOn[]> {
    let request = ListAddOnsByApp.debounceRequestsByApp.get(appIdentifier);
    if (!request || !debounce) {
      const requestInit = await generateRequestInit(this.signal);
      request = this.addOnService.listByApp(appIdentifier, requestInit);
    }
    if (debounce) {
      ListAddOnsByApp.debounceRequestsByApp.set(appIdentifier, request);
    }
    const addOns = await request;
    ListAddOnsByApp.debounceRequestsByApp.delete(appIdentifier);

    return addOns;
  }

  /**
   * Dispose of the abort controller
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
