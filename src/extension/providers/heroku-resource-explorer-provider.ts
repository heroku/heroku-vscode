import AppService from '@heroku-cli/schema/services/app-service.js';
import type { AddOn, App, Dyno } from '@heroku-cli/schema';
import DynoService from '@heroku-cli/schema/services/dyno-service.js';
import vscode, { AuthenticationSession, TreeItemCollapsibleState } from 'vscode';
import AddOnService from '@heroku-cli/schema/services/add-on-service.js';
import { getHerokuAppNames } from '../utils/get-heroku-app-name';
import { propertyChangeNotifierFactory, Bindable } from '../meta/property-change-notfier';

const dynoIconsBySize = {
  Free:'/resources/dyno/dynomite-free-16.png',
  Eco :'/resources/dyno/dynomite-eco-16.png',
  Hobby : '/resources/dyno/dynomite-hobby-16.png',
  Basic : '/resources/dyno/dynomite-basic-16.png',
  'Standard-1X' : '/resources/dyno/dynomite-default-16.png',
  'Standard-2X' : '/resources/dyno/dynomite-default-16.png',
  '1X' : '/resources/dyno/dynomite-1x-16.png',
  '2X' : '/resources/dyno/dynomite-2x-16.png',
  PX : '/resources/dyno/dynomite-px-16.png',
  'Performance-M': '/resources/dyno/dynomite-pm-16.png',
  Performance: '/resources/dyno/dynomite-ps-16.png',
  'Performance-L': '/resources/dyno/dynomite-pl-16.png',
  'Performance-L-RAM' : '/resources/dyno/dynomite-pl-16.png',
  'Performance-XL' : '/resources/dyno/dynomite-px-pl.png',
  'Performance-2XL' : '/resources/dyno/dynomite-px-pl.png',
};

/**
 * The HerokuResourceExplorerProvider is the main entity for
 * managing the Heroku Resource Explorer tree view.
 */
export class HerokuResourceExplorerProvider<T extends (App | Bindable<Dyno> | Bindable<AddOn | vscode.TreeItem>)> extends vscode.EventEmitter<T> implements vscode.TreeDataProvider<T> {
  public onDidChangeTreeData: vscode.Event<T | T[]> = this.event;

  protected dynoService = new DynoService(fetch, 'https://api.heroku.com');
  protected appService = new AppService(fetch, 'https://api.heroku.com');
  protected addOnService = new AddOnService(fetch, 'https://api.heroku.com');

  protected apps: App[] = [];
  protected dynos: Array<Bindable<Dyno>> = [];
  protected addOns: Array<Bindable<AddOn>> = [];

  protected requestInit = { headers: {} };
  protected elementTypeMap = new Map<T, 'App' | 'Dyno' | 'AddOn'>();

  /**
   * Constructs a new HerokuResourceExplorerProvider
   *
   * @param context The ExtensionContext provided by VSCode
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
  }

  /**
   * @inheritdoc
   */
  public async getTreeItem(element: T): Promise<vscode.TreeItem> {
    switch(this.elementTypeMap.get(element)) {
      case 'AddOn':
        return this.getAddOnTreeItem(element as AddOn);

      case 'App':
        return this.getAppTreeItem(element as App);

      case 'Dyno':
        return this.getDynoTreeItem(element as Dyno);

      default:
        return element as vscode.TreeItem;
    }
  }

  /**
   * @inheritdoc
   */
  public async getChildren(element?: T): Promise<T[]> {
    // children
    if (element) {
      if (this.elementTypeMap.get(element) === 'App') {
        return this.getAppCategories(element.id as string) as T[];
      }
      if (Reflect.has(element, 'collapsibleState')) {
        const [appIdentifier] = element.id?.split(':') ?? [];

        switch ((element as vscode.TreeItem).label) {
          case 'DYNOS':
            return await this.getDynosForApp(appIdentifier) as T[];

          case 'ADDONS':
            return await this.getAddonsForApp(appIdentifier) as T[];

          case 'SETTINGS':
            return this.getSettingsCategories(appIdentifier) as T[];

          default:
            return [];
        }
      }
      return [];
    }

    // Root items
    if (this.apps.length) {
      return this.apps as T[];
    }

    try {
      const { accessToken } = await vscode.authentication.getSession('heroku:auth:login', []) as AuthenticationSession;
      Reflect.set(this.requestInit.headers, 'Authorization', `Bearer ${accessToken}`);
      const appNames = getHerokuAppNames();

      for (const appName of appNames) {
        const appInfo = await this.appService.info(appName, this.requestInit);
        this.elementTypeMap.set(appInfo as T, 'App');
        this.apps.push(appInfo);
      }
      return this.apps as T[];
    } catch {
      return [];
    }
  }

  /**
   * Gets the icon path for the specified Dyno
   *
   * @param dyno The Dyno to get the icon for
   * @returns string The path of the dyno icon
   */
  protected getDynoIconPath(dyno: Dyno): string {
    return this.context.asAbsolutePath(dynoIconsBySize[dyno.size as keyof typeof dynoIconsBySize]);
  }

  /**
   * Get the Dynos for the specified app and subscribes
   * to property changes on each object retured.
   *
   * @param appIdentifier The ID of the app to get dynos for
   * @returns An array of Bindable<Dyno>
   */
  private async getDynosForApp(appIdentifier: string): Promise<Array<Bindable<Dyno>>> {
    if (this.dynos.length) {
      return this.dynos;
    }
    const dynos = await this.dynoService.list(appIdentifier, this.requestInit);

    this.dynos = dynos.map(propertyChangeNotifierFactory);
    this.dynos.forEach(dyno => {
      this.elementTypeMap.set(dyno as T, 'Dyno');
      dyno.addListener('propertyChanged', () => this.fire(dyno as T));
    });
    return this.dynos;
  }

  /**
   * Gets the addons for the specified app id and
   * listens to property changes on each object returned.
   *
   * @param appIdentifier The id of the app to get addons for.
   * @returns an array of Bindable<AddOn>
   */
  private async getAddonsForApp(appIdentifier: string): Promise<Array<Bindable<AddOn>>> {
    if (this.addOns.length) {
      return this.addOns;
    }
    const addOns = await this.addOnService.listByApp(appIdentifier, this.requestInit);

    this.addOns = addOns.map(propertyChangeNotifierFactory);
    this.addOns.forEach(addOn => {
      this.elementTypeMap.set(addOn as T, 'AddOn');
      addOn.addListener('propertyChanged', () => this.fire(addOn as T));
    });
    return this.addOns;
  }

  /**
   * Gets the main tree nodes for the resource explorer.
   *
   * @param appIdentifier The app id or name
   * @returns an array of TreeItem
   */
  private getAppCategories(appIdentifier: string): vscode.TreeItem[] {
    return [
      {
        id: appIdentifier + ':dynos',
        label: 'DYNOS',
        collapsibleState: TreeItemCollapsibleState.Expanded,
      },
      {
        id: appIdentifier + ':addons',
        label: 'ADDONS',
        collapsibleState: TreeItemCollapsibleState.Expanded
      },
      {
        id: appIdentifier + ':settings',
        label: 'SETTINGS',
        collapsibleState: TreeItemCollapsibleState.Expanded
      }
    ];
  }

  /**
   * Gets the categories for the settings section.
   *
   * @param appIdentifier The app id or name
   * @returns vscode.TreeItem[]
   */
  private getSettingsCategories(appIdentifier: string): vscode.TreeItem[] {
    return [
      {
        id: appIdentifier + ':app-info',
        label: 'App Information',
      },
      {
        id: appIdentifier + ':config-vars',
        label: 'Config Vars',
      },
      {
        id: appIdentifier + ':buildpacks',
        label: 'Buildpacks',
      },
      {
        id: appIdentifier + ':ssl-certs',
        label: 'SSL Certificates',
      },
      {
        id: appIdentifier + ':domains',
        label: 'Domains',
      },
    ];
  }

  /**
   * Consumes a Dyno object and returns a TreeItem.
   *
   * @param dyno The Dyno to convert to a TreeItem
   * @returns The TreeItem from the specified Dyno
   */
  private getDynoTreeItem(dyno: Dyno): vscode.TreeItem {
    return {
      id: dyno.id,
      label: dyno.name,
      description: `${dyno.command} - ${dyno.state}`,
      iconPath: this.getDynoIconPath(dyno),
      tooltip: `${dyno.app.name} - ${dyno.size}`,
      contextValue: `dyno:${dyno.state}`
    } as vscode.TreeItem;
  }

  /**
   * Consumes an App object and returns a TreeItem.
   *
   * @param app The App to convert to a TreeItem
   * @returns The TreeItem from the specified Dyno
   */
  private getAppTreeItem(app: App): vscode.TreeItem {
    return {
      id: app.id,
      label: app.name,
      description: app.buildpack_provided_description ?? '',
      tooltip: `${app.name} - ${app.organization?.name ?? app.team?.name}`,
      collapsibleState: TreeItemCollapsibleState.Expanded
    } as vscode.TreeItem;
  }

  /**
   * Consumes an AddOn object and returns a TreeItem.
   *
   * @param addOn The AddOn to convert to a TreeItem
   * @returns The TreeItem from the specified Dyno
   */
  private async getAddOnTreeItem(addOn: AddOn): Promise<vscode.TreeItem> {
    // Grab the icon from https://addons.heroku.com
    let iconUrl: string | undefined;
    try {
      const addonsApiResponse = await fetch(`https://addons.heroku.com/api/v2/addons/${addOn.addon_service.id}`);
      const json = await addonsApiResponse.json() as {addon:{icon_url: string}};
      iconUrl = json.addon.icon_url;
    } catch {
      // no-op - don't worry, this won't break things too badly.
    }
    return {
      id: addOn.id,
      label: addOn.addon_service.name,
      description: `(${addOn.name})`,
      tooltip: `${addOn.app.name} - ${addOn.state}`,
      iconPath: iconUrl ? vscode.Uri.parse(`https://addons.heroku.com/${iconUrl}`) : undefined
    } as vscode.TreeItem;
  }
}
