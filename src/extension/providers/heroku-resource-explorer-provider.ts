import { randomUUID } from 'node:crypto';
import AppService from '@heroku-cli/schema/services/app-service.js';
import type { AddOn, App, Dyno, Formation, LogSession } from '@heroku-cli/schema';
import DynoService from '@heroku-cli/schema/services/dyno-service.js';
import vscode, { type AuthenticationSession, TreeItemCollapsibleState } from 'vscode';
import AddOnService from '@heroku-cli/schema/services/add-on-service.js';
import FormationService from '@heroku-cli/schema/services/formation-service.js';
import { getHerokuAppNames } from '../utils/get-heroku-app-name';
import { propertyChangeNotifierFactory, type Bindable, PropertyChangedEvent } from '../meta/property-change-notfier';
import { RestartDynoCommand } from '../commands/dyno/restart-dyno';
import { ShowAddonsViewCommand } from '../commands/add-on/show-addons-view';
import { PollAddOnState } from '../commands/add-on/poll-state';

import '../commands/app/context-menu/start-log-session';
import '../commands/app/context-menu/open-app';
import '../commands/app/context-menu/open-settings';
import '../commands/app/context-menu/end-log-session';

const dynoIconsBySize = {
  Free: '/resources/dyno/dynomite-free-16.png',
  Eco: '/resources/dyno/dynomite-eco-16.png',
  Hobby: '/resources/dyno/dynomite-hobby-16.png',
  Basic: '/resources/dyno/dynomite-basic-16.png',
  'Standard-1X': '/resources/dyno/dynomite-default-16.png',
  'Standard-2X': '/resources/dyno/dynomite-default-16.png',
  '1X': '/resources/dyno/dynomite-1x-16.png',
  '2X': '/resources/dyno/dynomite-2x-16.png',
  PX: '/resources/dyno/dynomite-px-16.png',
  'Performance-M': '/resources/dyno/dynomite-pm-16.png',
  Performance: '/resources/dyno/dynomite-ps-16.png',
  'Performance-L': '/resources/dyno/dynomite-pl-16.png',
  'Performance-L-RAM': '/resources/dyno/dynomite-pl-16.png',
  'Performance-XL': '/resources/dyno/dynomite-px-pl.png',
  'Performance-2XL': '/resources/dyno/dynomite-px-pl.png'
};

type LogSessionCapableApp = Bindable<App & { logSession?: LogSession }>;

/**
 * The HerokuResourceExplorerProvider is the main entity for
 * managing the Heroku Resource Explorer tree view.
 */
export class HerokuResourceExplorerProvider<
    T extends LogSessionCapableApp | Bindable<Dyno> | Bindable<Formation> | Bindable<AddOn | vscode.TreeItem>
  >
  extends vscode.EventEmitter<T>
  implements vscode.TreeDataProvider<T>
{
  public onDidChangeTreeData: vscode.Event<T | T[]> = this.event;

  protected dynoService = new DynoService(fetch, 'https://api.heroku.com');
  protected appService = new AppService(fetch, 'https://api.heroku.com');
  protected addOnService = new AddOnService(fetch, 'https://api.heroku.com');
  protected formationService = new FormationService(fetch, 'https://api.heroku.com');

  protected apps: App[] = [];

  protected requestInit = { headers: {} };
  protected elementTypeMap = new WeakMap<T, 'App' | 'Dyno' | 'AddOn' | 'Formation'>();
  protected childParentMap = new WeakMap<T, T>();

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
    switch (this.elementTypeMap.get(element)) {
      case 'AddOn':
        return this.getAddOnTreeItem(element as AddOn);

      case 'App':
        return this.getAppTreeItem(element as LogSessionCapableApp);

      case 'Dyno':
        return this.getDynoTreeItem(element as Dyno);

      case 'Formation':
        return this.getFormationTreeItem(element as Formation);

      default:
        return element as vscode.TreeItem;
    }
  }

  /**
   * Gets the parent for the specified child
   *
   * @param element The child element to get the parent of
   * @returns T
   */
  public getParent(element: T): T | undefined {
    return this.childParentMap.get(element);
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
          case 'FORMATIONS':
            return (await this.getFormationsForApp(appIdentifier, element)) as T[];

          case 'DYNOS':
            return (await this.getDynosForApp(appIdentifier, element)) as T[];

          case 'ADD-ONS':
            return (await this.getAddonsForApp(appIdentifier, element)) as T[];

          case 'SETTINGS':
            return this.getSettingsCategories(appIdentifier, element) as T[];

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
      const { accessToken } = (await vscode.authentication.getSession(
        'heroku:auth:login',
        []
      )) as AuthenticationSession;
      Reflect.set(this.requestInit.headers, 'Authorization', `Bearer ${accessToken}`);
      const appNames = await getHerokuAppNames();

      for (const appName of appNames) {
        const appInfo = await this.appService.info(appName, this.requestInit);
        const app = propertyChangeNotifierFactory(appInfo);
        app.addListener(PropertyChangedEvent.PROPERTY_CHANGED, () => this.fire(app as T));
        this.apps.push(app);
        this.elementTypeMap.set(app as T, 'App');
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
  protected getDynoIconPath(dyno: Dyno): string | vscode.ThemeIcon {
    if (dyno.state === 'starting') {
      return new vscode.ThemeIcon('loading~spin');
    }
    return this.context.asAbsolutePath(dynoIconsBySize[dyno.size as keyof typeof dynoIconsBySize]);
  }

  /**
   * Get the Formations for the specified app and subscribes
   * to property changes on each object retured.
   *
   * @param appIdentifier The ID of the app to get formatons for
   * @param parent The parent element the formations belongs to
   * @returns An array of Bindable<Formation>
   */
  private async getFormationsForApp(appIdentifier: string, parent: T): Promise<Formation[]> {
    const formations = await this.formationService.list(appIdentifier, this.requestInit);
    const boundFormations = formations.map(propertyChangeNotifierFactory);
    boundFormations.forEach((formation) => {
      this.elementTypeMap.set(formation as T, 'Formation');
      this.childParentMap.set(formation as T, parent);
      formation.addListener('propertyChanged', (event: PropertyChangedEvent<Formation>) => {
        if (event.property === 'quantity') {
          this.fire(this.getParent(event.target as unknown as T) as T);
        }
        this.fire(formation as T);
      });
    });
    return boundFormations;
  }

  /**
   * Get the Dynos for the specified app and subscribes
   * to property changes on each object retured.
   *
   * @param appIdentifier The ID of the app to get dynos for.
   * @param parent The parent elemnent the dyno tree items will belong to.
   * @returns An array of Bindable<Dyno>.
   */
  private async getDynosForApp(appIdentifier: string, parent: T): Promise<Array<Bindable<Dyno>>> {
    const dynos = await this.dynoService.list(appIdentifier, this.requestInit);
    if (!dynos.length) {
      const empty = {
        type: 'empty'
      } as Bindable<Dyno>;
      this.elementTypeMap.set(empty as T, 'Dyno');
      return [empty];
    }

    const boundDynos = dynos.map(propertyChangeNotifierFactory);
    boundDynos.forEach((dyno) => {
      this.elementTypeMap.set(dyno as T, 'Dyno');
      this.childParentMap.set(dyno as T, parent);
      dyno.addListener('propertyChanged', () => this.fire(dyno as T));
      if (dyno.state === 'starting') {
        void vscode.commands.executeCommand(RestartDynoCommand.COMMAND_ID, dyno, true);
      }
    });
    return boundDynos;
  }

  /**
   * Gets the addons for the specified app id and
   * listens to property changes on each object returned.
   *
   * @param appIdentifier The id of the app to get addons for.
   * @param parent The parent element the AddOns belong to
   * @returns an array of Bindable<AddOn>
   */
  private async getAddonsForApp(appIdentifier: string, parent: T): Promise<Array<Bindable<AddOn>>> {
    const addOns: AddOn[] = [
      {
        id: randomUUID(),
        app: {
          id: appIdentifier
        },
        name: 'Search Elements Marketplace'
      } as AddOn
    ];
    try {
      addOns.push(...(await this.addOnService.listByApp(appIdentifier, this.requestInit)));
    } catch {
      // no-op
    }
    const boundAddons = addOns.map(propertyChangeNotifierFactory);
    boundAddons.forEach((addOn) => {
      this.elementTypeMap.set(addOn as T, 'AddOn');
      this.childParentMap.set(addOn as T, parent);
      if (addOn.state === 'provisioning') {
        void vscode.commands.executeCommand(PollAddOnState.COMMAND_ID, addOn);
      }
      addOn.addListener('propertyChanged', () => this.fire(addOn as T));
    });
    return boundAddons;
  }

  /**
   * Gets the main tree nodes for the resource explorer.
   *
   * @param appIdentifier The app id or name.
   * @returns an array of TreeItem.
   */
  private getAppCategories(appIdentifier: string): vscode.TreeItem[] {
    const appCategories = [
      {
        id: appIdentifier + ':formations',
        label: 'FORMATIONS',
        collapsibleState: TreeItemCollapsibleState.Expanded
      },
      {
        id: appIdentifier + ':dynos',
        label: 'DYNOS',
        collapsibleState: TreeItemCollapsibleState.Expanded
      },
      {
        id: appIdentifier + ':addons',
        label: 'ADD-ONS',
        collapsibleState: TreeItemCollapsibleState.Expanded
      },
      {
        id: appIdentifier + ':settings',
        label: 'SETTINGS',
        collapsibleState: TreeItemCollapsibleState.Expanded
      }
    ].map((cat) => propertyChangeNotifierFactory(cat));
    appCategories.forEach((cat) => cat.addListener('propertyChanged', () => this.fire(cat as T)));
    return appCategories;
  }

  /**
   * Gets the categories for the settings section.
   *
   * @param appIdentifier The app id or name
   * @param parent The parent node that the categories belongs to.
   *
   * @returns vscode.TreeItem[]
   */
  private getSettingsCategories(appIdentifier: string, parent: T): vscode.TreeItem[] {
    const categories = [
      {
        id: appIdentifier + ':app-info',
        label: 'App Information'
      },
      {
        id: appIdentifier + ':config-vars',
        label: 'Config Vars'
      },
      {
        id: appIdentifier + ':buildpacks',
        label: 'Buildpacks'
      },
      {
        id: appIdentifier + ':ssl-certs',
        label: 'SSL Certificates'
      },
      {
        id: appIdentifier + ':domains',
        label: 'Domains'
      }
    ];
    categories.forEach((cat) => this.childParentMap.set(cat as T, parent));
    return categories;
  }

  /**
   * Consumes a Dyno object and returns a TreeItem.
   *
   * @param dyno The Dyno to convert to a TreeItem
   * @returns The TreeItem from the specified Dyno
   */
  private getDynoTreeItem(dyno: Dyno): vscode.TreeItem {
    if (dyno.type === 'empty') {
      return {
        id: 'empty',
        label: 'No Dynos running',
        iconPath: new vscode.ThemeIcon('warning')
      };
    }
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
   * Consumes a Formation object and returns a TreeItem
   *
   * @param formation The Formation to convert to a tree item.
   * @returns The TreeItem from the specified Formation
   */
  private getFormationTreeItem(formation: Formation): vscode.TreeItem {
    const canIncreaseDynoCount =
      (!/(Free|Eco|Hobby|Basic|)/.test(formation.size) && formation.quantity < 100) || !formation.quantity;
    let contextValue = `formation`;
    if (canIncreaseDynoCount) {
      contextValue += ':scale-up';
    }

    if (formation.quantity) {
      contextValue += ':scale-down';
    }

    return {
      id: formation.id,
      label: formation.type,
      description: `${formation.size} - ${formation.quantity} ${formation.quantity === 1 ? 'Dyno' : 'Dynos'}`,
      iconPath: this.context.asAbsolutePath('/resources/formation-icon-16.png'),
      contextValue
    } as vscode.TreeItem;
  }

  /**
   * Consumes an App object and returns a TreeItem.
   *
   * @param app The App to convert to a TreeItem
   * @returns The TreeItem from the specified Dyno
   */
  private getAppTreeItem(app: LogSessionCapableApp): vscode.TreeItem {
    return {
      id: app.id,
      label: app.name,
      description: app.buildpack_provided_description ?? '',
      tooltip: `${app.name} - ${app.organization?.name ?? app.team?.name ?? app.owner.email}`,
      collapsibleState: TreeItemCollapsibleState.Expanded,
      contextValue: app.logSession ? 'heroku:app:log-session-started' : 'heroku:app'
    } as vscode.TreeItem;
  }

  /**
   * Consumes an AddOn object and returns a TreeItem.
   *
   * @param addOn The AddOn to convert to a TreeItem
   * @returns The TreeItem from the specified Dyno
   */
  private async getAddOnTreeItem(addOn: AddOn): Promise<vscode.TreeItem> {
    if (addOn.name === 'Search Elements Marketplace') {
      const categoryNode = this.getParent(addOn as T);
      return {
        id: addOn.id,
        label: addOn.name,
        iconPath: this.context.asAbsolutePath('/resources/marketing-addon-48.png'),
        command: {
          command: ShowAddonsViewCommand.COMMAND_ID,
          title: 'Find more add-ons',
          arguments: [addOn.app.id, this.context.extensionUri, categoryNode]
        }
      };
    }
    // Grab the icon from https://addons.heroku.com
    let iconUrl: string = '';
    try {
      const addonsApiResponse = await fetch(`https://addons.heroku.com/api/v2/addons/${addOn.addon_service.id}`);
      const json = (await addonsApiResponse.json()) as { addon: { icon_url: string } };
      iconUrl = URL.canParse(json.addon.icon_url)
        ? json.addon.icon_url
        : `https://addons.heroku.com/${json.addon.icon_url}`;
    } catch {
      // no-op - don't worry, this won't break things too badly.
    }
    return {
      id: addOn.id,
      label: addOn.addon_service.name,
      description: `- ${addOn.state}`,
      tooltip: `${addOn.name}`,
      iconPath: addOn.state === 'provisioning' ? new vscode.ThemeIcon('loading~spin') : vscode.Uri.parse(iconUrl)
    } as vscode.TreeItem;
  }
}
