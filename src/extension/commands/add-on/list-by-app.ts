import type { AddOn } from '@heroku-cli/schema';
import { herokuCommand, type RunnableCommand } from '../../meta/command';
import { createHerokuSDK } from '../../utils/heroku-sdk';

@herokuCommand()
/**
 * List add-ons by app
 */
export class ListAddOnsByApp extends AbortController implements RunnableCommand<AddOn[]> {
  public static COMMAND_ID = 'heroku:addons:list-by-app' as const;
  private static debounceRequestsByApp = new Map<string, Promise<AddOn[]>>();

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
      const sdk = await createHerokuSDK(this.signal);
      // The resource explorer's existing types are tied to the
      // legacy @heroku-cli/schema AddOn shape; cast at the boundary
      // so the rest of the file stays unchanged.
      request = sdk.platform.addOn.listByApp(appIdentifier) as Promise<AddOn[]>;
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
