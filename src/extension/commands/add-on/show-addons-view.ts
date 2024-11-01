import EventEmitter from 'node:events';
import vscode, { AuthenticationSession, WebviewPanel } from 'vscode';
import PlanService from '@heroku-cli/schema/services/plan-service.js';
import AddOnService from '@heroku-cli/schema/services/add-on-service.js';
import { AddOn } from '@heroku-cli/schema';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import importMap from '../../importmap.json';
import { convertImportMapPathsToUris } from '../../utils/import-paths-to-uri';

type MessagePayload =
  | {
      type: 'addons';
      id?: never;
      plan?: never;
      installedAddonId?: never;
    }
  | {
      type: 'addonPlans';
      id: string;
      plan?: never;
      installedAddonId: never;
    }
  | {
      type: 'installAddon' | 'updateAddon';
      id: string;
      plan: string;
      installedAddonId: string;
    };

@herokuCommand()
/**
 * The ShowAddonsViewCommand displays the addons marketplace
 * as a WebView in VSCode
 */
export class ShowAddonsViewCommand extends AbortController implements RunnableCommand<Promise<void>> {
  public static COMMAND_ID = 'heroku:addons:show-addons-view' as const;
  private static addonsPanel: WebviewPanel | undefined;
  private planService = new PlanService(fetch, 'https://api.heroku.com');
  private addonService = new AddOnService(fetch, 'https://api.heroku.com');

  private appIdentifier!: string;
  private notifier: EventEmitter | undefined;

  /**
   * Creates and displays a webview for showing
   * the add-on marketplace
   *
   * @param appIdentifier The application identifier.
   * @param extensionUri The Uri of the extension.
   * @param notifier The notification emitter.
   * @returns Promise<void>
   */
  public async run(appIdentifier: string, extensionUri: vscode.Uri, notifier: EventEmitter): Promise<void> {
    this.notifier = notifier;
    this.notifier.on('installedAddOnsChanged', this.onInstalledAddOnsChanged);

    ShowAddonsViewCommand.addonsPanel?.dispose();
    ShowAddonsViewCommand.addonsPanel = undefined;

    this.appIdentifier = appIdentifier;
    const panel = vscode.window.createWebviewPanel('Addons', 'Elements Marketplace', vscode.ViewColumn.One, {
      enableScripts: true
    });
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'element.svg');
    const { webview } = panel;
    webview.onDidReceiveMessage(this.onMessage);

    const onDiskPath = vscode.Uri.joinPath(extensionUri, 'out/webviews/addons-view', 'index.js');
    const indexPath = webview.asWebviewUri(onDiskPath);
    const webViewImportMap = {
      ...importMap,
      imports: convertImportMapPathsToUris(webview, importMap.imports, extensionUri)
    };

    webview.html = `
    <html style="height: 100%;" lang="en">
    <head>
      <script type="importmap">
      ${JSON.stringify(webViewImportMap)}
      </script>

      <script type="module" src="${indexPath.toString()}"></script>
      <title></title>
    </head>
      <body style="min-height: 100%; display: flex;">
        <heroku-add-ons>Add-on not loaded</heroku-add-ons>
      </body>
    </html>`;

    ShowAddonsViewCommand.addonsPanel = panel;
    const { promise, resolve } = Promise.withResolvers();
    panel.onDidDispose(resolve);

    await promise;
  }

  /**
   * Disposes of internal resources and aborts
   * any pending API requests.
   */
  public [Symbol.dispose](): void {
    this.notifier?.removeAllListeners();
    this.abort();
  }

  private onInstalledAddOnsChanged = (): void => {
    void this.onMessage({ type: 'addons' });
  };

  private onMessage = async (message: MessagePayload): Promise<void> => {
    const { webview } = ShowAddonsViewCommand.addonsPanel as WebviewPanel;
    switch (message.type) {
      case 'addons':
        {
          const addonsByCategoryResponse = await fetch('https://addons.heroku.com/api/v2/categories');
          const installedAddons = await this.addonService.listByApp(
            this.appIdentifier,
            await this.generateRequestInit()
          );
          if (addonsByCategoryResponse.ok) {
            const addons = (await addonsByCategoryResponse.json()) as { categories: unknown };
            await webview.postMessage({ type: 'addons', payload: { categories: addons.categories, installedAddons } });
          }
        }
        break;

      case 'addonPlans':
        {
          try {
            const addonPlans = await this.planService.listByAddOn(message.id, await this.generateRequestInit());
            await webview.postMessage({ type: 'addonPlans', payload: addonPlans, id: message.id });
          } catch {
            // no-op
          }
        }
        break;

      case 'installAddon':
        void this.installOrUpdateAddOn('installAddon', message.id, message.plan);
        break;

      case 'updateAddon':
        void this.installOrUpdateAddOn('updateAddon', message.id, message.plan, message.installedAddonId);
        break;
    }
  };

  private async installOrUpdateAddOn(type: 'installAddon', addOnId: string, plan: string): Promise<void>;
  private async installOrUpdateAddOn(
    type: 'updateAddon',
    addOnId: string,
    plan: string,
    installedAddonId: string
  ): Promise<void>;
  /**
   * Installs or updates an add-on for the application
   * and sends a message to the webview with the result.
   *
   * @param type The type of operation to peform.
   * @param addOnId The id of the addon to install or update.
   * @param plan The plan to install or update.
   * @param installedAddonId The id of the installed addon to update. Required only when type is 'updateAddon'
   * @returns void
   */
  private async installOrUpdateAddOn(
    type: 'installAddon' | 'updateAddon',
    addOnId: string,
    plan: string,
    installedAddonId?: string
  ): Promise<void> {
    const { webview } = ShowAddonsViewCommand.addonsPanel as WebviewPanel;
    try {
      const requestInit = await this.generateRequestInit();
      let newlyCreatedOrUpdatedAddon: AddOn;
      if (type === 'installAddon') {
        newlyCreatedOrUpdatedAddon = await this.addonService.create(this.appIdentifier, { plan }, requestInit);
      } else {
        newlyCreatedOrUpdatedAddon = await this.addonService.update(
          this.appIdentifier,
          installedAddonId as string,
          { plan },
          requestInit
        );
      }

      await webview.postMessage({ type: 'addonCreated', payload: newlyCreatedOrUpdatedAddon, id: addOnId });
      this.notifier?.emit('addonCreated', newlyCreatedOrUpdatedAddon);
    } catch (e) {
      const { message: errorMessage } = e as Error;
      await webview.postMessage({ type: 'addonCreationFailed', payload: errorMessage, id: addOnId });
      await vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Generates a request init object for making API requests to the Heroku API.
   *
   * @returns A promise that resolves to a request init object.
   */
  private async generateRequestInit(): Promise<RequestInit> {
    const { accessToken } = (await vscode.authentication.getSession('heroku:auth:login', [])) as AuthenticationSession;
    return { signal: this.signal, headers: { Authorization: `Bearer ${accessToken.trim()}` } };
  }
}
