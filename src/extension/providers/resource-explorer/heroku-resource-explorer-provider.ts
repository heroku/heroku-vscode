import AppService from '@heroku-cli/schema/services/app-service.js';
import type { AddOn, App, Dyno, Formation } from '@heroku-cli/schema';
import DynoService from '@heroku-cli/schema/services/dyno-service.js';
import vscode, { type AuthenticationSession } from 'vscode';

import FormationService from '@heroku-cli/schema/services/formation-service.js';
import { getHerokuAppNames } from '../../utils/git-utils';
import { ListAddOnsByApp } from '../../commands/add-on/list-by-app';

import { WatchConfig } from '../../commands/git/watch-config';
import type { LogSessionStream } from '../../commands/app/context-menu/start-log-session';
import {
  LogStreamClient,
  LogStreamEvents,
  type StartingProcessInfo,
  type ScaledToInfo,
  type StateChangedInfo
} from './log-stream-client';
import {
  getAddOnTreeItem,
  getAppCategories,
  getAppTreeItem,
  getDynoTreeItem,
  getFormationTreeItem
} from './tree-item-generator';

// Commands used in quick access menus
import '../../commands/app/context-menu/start-log-session';
import '../../commands/app/context-menu/open-app';
import '../../commands/app/context-menu/open-settings';
import '../../commands/app/context-menu/end-log-session';
import '../../commands/dyno/scale-formation';
import '../../commands/dyno/restart-dyno';

/**
 * Represents an App that can have a LogSession
 */
type LogSessionCapableApp = App & { logSession?: LogSessionStream | undefined };
/**
 * Represents the possible types of data that can be displayed in the Heroku Resource Explorer tree view.
 */
type ExtendedTreeDataTypes = LogSessionCapableApp | Dyno | Formation | AddOn | vscode.TreeItem;
/**
 * The HerokuResourceExplorerProvider is the main entity for
 * managing the Heroku Resource Explorer tree view.
 */
export class HerokuResourceExplorerProvider<T extends ExtendedTreeDataTypes = ExtendedTreeDataTypes>
  extends vscode.EventEmitter<T | undefined>
  implements vscode.TreeDataProvider<T>
{
  public onDidChangeTreeData: vscode.Event<T | T[] | undefined> = this.event;

  protected dynoService = new DynoService(fetch, 'https://api.heroku.com');
  protected appService = new AppService(fetch, 'https://api.heroku.com');
  protected formationService = new FormationService(fetch, 'https://api.heroku.com');

  protected apps: App[] = [];
  protected appToResourceMap = new WeakMap<
    App,
    { dynos: Dyno[]; formations: Formation[]; addOns: AddOn[]; categories: vscode.TreeItem[] }
  >();

  protected logStreamClient = new LogStreamClient();

  protected requestInit = { headers: {} };
  protected elementTypeMap = new WeakMap<T, 'App' | 'Dyno' | 'AddOn' | 'Formation'>();
  protected childParentMap = new WeakMap<T, T>();

  protected abortWatchGitConfig = new AbortController();
  protected syncAddonsPending = false;

  /**
   * Constructs a new HerokuResourceExplorerProvider
   *
   * @param context The ExtensionContext provided by VSCode
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
    void this.watchGitConfig();
  }

  /**
   * @inheritdoc
   */
  public async getTreeItem(element: T): Promise<vscode.TreeItem> {
    switch (this.elementTypeMap.get(element)) {
      case 'AddOn':
        return getAddOnTreeItem(this.context, element as AddOn, this.getParent(element) as vscode.TreeItem);

      case 'App': {
        const app = element as LogSessionCapableApp;
        return getAppTreeItem(this.context, app, !app.logSession || !!app.logSession?.muted);
      }

      case 'Dyno':
        return getDynoTreeItem(this.context, element as Dyno);

      case 'Formation':
        return getFormationTreeItem(this.context, element as Formation);

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
        const { categories: cachedCategories } = this.appToResourceMap.get(element as App) ?? {};
        if (cachedCategories?.length) {
          return cachedCategories as T[];
        }
        const appCategories = getAppCategories(element.id as string) as T[];
        appCategories.forEach((category) => this.childParentMap.set(category, element));
        this.appToResourceMap.get(element as App)!.categories.push(...(appCategories as vscode.TreeItem[]));
        return appCategories;
      }
      if (Reflect.has(element, 'collapsibleState')) {
        const app = this.getParent(element) as App;

        switch ((element as vscode.TreeItem).label) {
          case 'FORMATIONS':
            return (await this.getFormationsForApp(app, element)) as T[];

          case 'DYNOS':
            return (await this.getDynosForApp(app, element)) as T[];

          case 'ADD-ONS':
            return (await this.getAddonsForApp(app, element)) as T[];

          case 'SETTINGS':
            return this.getSettingsCategories(app, element) as T[];

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
      const appsNotFound = [];
      for (const appName of appNames) {
        let appInfo: App;
        try {
          appInfo = await this.appService.info(appName, { ...this.requestInit });
        } catch {
          appsNotFound.push(appName);
          continue;
        }
        this.apps.push(appInfo);
        this.elementTypeMap.set(appInfo as T, 'App');
        this.appToResourceMap.set(appInfo, { dynos: [], formations: [], addOns: [], categories: [] });
      }
      this.logStreamClient.apps = this.apps;
      this.startLiveUpdates();
      if (appsNotFound.length) {
        void this.showAppsNotFound(appsNotFound);
      }
      return this.apps as T[];
    } catch {
      return [];
    }
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.abortWatchGitConfig.abort();
  }

  /**
   * Starts live updates for the apps
   * and it's resources.
   */
  private startLiveUpdates(): void {
    this.logStreamClient.addListener(LogStreamEvents.SCALED_TO, this.onFormationScaledTo);
    this.logStreamClient.addListener(LogStreamEvents.STATE_CHANGED, this.onDynoStateChanged);
    this.logStreamClient.addListener(LogStreamEvents.STARTING_PROCESS, this.onDynoProcessStarting);

    this.logStreamClient.addListener(LogStreamEvents.MUTED_CHANGED, this.onStreamMutedChanged);
  }

  /**
   * Event handler for Dyno scale events.
   *
   * @param data The data dispatched when a Dyno scale occurs.
   */
  private onFormationScaledTo = (data: ScaledToInfo): void => {
    const { app, quantity, size } = data;
    const { dynos, formations, categories } = this.appToResourceMap.get(app)!;
    const formation = formations.find((f) => f.size === size);
    if (formation) {
      Reflect.set(formation, 'quantity', quantity);

      const dynosCategory = categories.find((cat) => cat.label === 'DYNOS');
      // down scaling will shut down Dynos which cannot be restarted.
      // These dynos need to be removed since they are no longer valid
      // but we want to display the visual indicator to the user that they have
      // been successfully stopped which occurs in the onDynoStateChanged.
      // This means we'll wait a bit before removing the Dynos from the tree.
      if (dynos.length > quantity) {
        void (async (): Promise<void> => {
          dynos.length = quantity;
          await new Promise((resolve) => setTimeout(resolve, 3000));
          this.fire(dynosCategory as T);
        })();
      }

      this.fire(formation as T);
    } else {
      // We might have added a new formation or
      // updated the size. Refresh these to ensure
      // pristine formation data.
      const formationsCategory = categories.find((cat) => cat.label === 'FORMATIONS');
      formations.length = 0;
      this.fire(formationsCategory as T);
    }
  };

  /**
   * Handler for the dyno state change event.
   *
   * @param data The data dispatched when a dyno state is changed.
   */
  private onDynoStateChanged = (data: StateChangedInfo): void => {
    const { app, dynoName, from, to } = data;
    const { dynos } = this.appToResourceMap.get(app)!;
    const dyno = dynos.find((d) => d.name === dynoName);
    if (!dyno) {
      return;
    }

    if (dyno.state !== to) {
      Reflect.set(dyno, 'state', to);
      this.fire(dyno as T);
    }

    // Not all add-on vendors use the Heroku-provided
    // log drain to write provisioning/deprovisioning
    // logs. Since Dynos are restarted with *most* changes
    // to an add-on, we must check for add-ons being
    // provisioned/deprovisioned when dynos restart.
    if (from === 'up' && to === 'starting') {
      void this.queueAddOnSynchronization(app);
    }
  };

  /**
   * Synchronizes the add-ons for the specified app.
   *
   * @param app The app to synchronize add-ons for
   */
  private async queueAddOnSynchronization(app: App): Promise<void> {
    if (this.syncAddonsPending) {
      return;
    }
    this.syncAddonsPending = true;
    const { addOns, categories } = this.appToResourceMap.get(app)!;
    const addonsMap = new Set(addOns.map((a) => a.id));

    addOns.length = 0;
    const addOnsCategory = categories.find((cat) => cat.label === 'ADD-ONS');
    const pristineAddons = await this.getAddonsForApp(app, addOnsCategory as T);

    const pristineAddonsMap = new Set(pristineAddons.map((a) => a.id));
    if (addonsMap.difference(pristineAddonsMap).size || pristineAddonsMap.difference(addonsMap).size) {
      this.fire(addOnsCategory as T);
    }
    this.syncAddonsPending = false;
  }

  /**
   * Handler for the dyno process starting event.
   *
   * @param data The data dispached when a dyno is starting.
   */
  private onDynoProcessStarting = (data: StartingProcessInfo): void => {
    const { app, dynoName } = data;
    const dynos = this.appToResourceMap.get(app)!.dynos;
    let dyno = dynos.find((d) => d.name === dynoName);

    if (!dyno) {
      void (async (): Promise<void> => {
        dyno = await this.dynoService.info(app.id, dynoName, this.requestInit);
        dynos.push(dyno);
        dynos.sort((a, b) => {
          const [, numA] = a.name.split('.');
          const [, numB] = b.name.split('.');
          if (numA === numB) {
            return 0;
          }
          return ~~numA < ~~numB ? -1 : 1;
        });

        const resources = this.appToResourceMap.get(app)!;
        const dynosCategory = resources.categories.find((cat) => cat.label === 'DYNOS');
        this.childParentMap.set(dyno as T, dynosCategory as T);
        this.elementTypeMap.set(dyno as T, 'Dyno');
        this.fire(dynosCategory as T);
      })();
    } else {
      Reflect.set(dyno, 'state', 'starting');
      this.fire(dyno as T);
    }
  };

  /**
   * Updates the app tree item to display the
   * appropriate icon when a log stream is started
   * or ended.
   *
   * @param app The app to update
   */
  private onStreamMutedChanged = (app: App): void => {
    this.fire(app as T);
  };

  /**
   * Shows the apps not found message and optionally
   * opens the dashboard to view all apps.
   *
   * @param appsNotFound string[]
   */
  private async showAppsNotFound(appsNotFound: string[]): Promise<void> {
    const message = appsNotFound.length > 1 ? 'Multiple apps were' : `${appsNotFound[0]} was`;
    const transitional = appsNotFound.length > 1 ? 'that do' : 'which does';

    const response = await vscode.window.showWarningMessage(
      `${message} found in your git remote ${transitional} not appear to exist on Heroku.`,
      'View apps',
      'Nevermind'
    );

    if (response === 'View apps') {
      void vscode.env.openExternal(vscode.Uri.parse('https://dashboard.heroku.com/apps'));
    }
  }

  /**
   * Get the Formations for the specified app and subscribes
   * to property changes on each object retured.
   *
   * @param app The app the get formations for.
   * @param parent The parent element the formations belongs to
   * @returns An array of Bindable<Formation>
   */
  private async getFormationsForApp(app: App, parent: T): Promise<Formation[]> {
    const { formations: cachedFormations } = this.appToResourceMap.get(app) ?? {};
    if (cachedFormations?.length) {
      return cachedFormations;
    }
    const formations = await this.formationService.list(app.id, this.requestInit);
    formations.forEach((formation) => {
      this.elementTypeMap.set(formation as T, 'Formation');
      this.childParentMap.set(formation as T, parent);
    });
    const appResources = this.appToResourceMap.get(app);
    appResources!.formations = formations;

    return formations;
  }

  /**
   * Get the Dynos for the specified app and subscribes
   * to property changes on each object retured.
   *
   * @param app The app to get dynos for.
   * @param parent The parent elemnent the dyno tree items will belong to.
   * @returns An array of Bindable<Dyno>.
   */
  private async getDynosForApp(app: App, parent: T): Promise<Dyno[]> {
    const { dynos: cachedDynos } = this.appToResourceMap.get(app) ?? {};
    if (cachedDynos?.length) {
      return cachedDynos;
    }

    const dynos = await this.dynoService.list(app.id, this.requestInit);
    if (!dynos.length) {
      const empty = {
        type: 'empty'
      } as Dyno;
      this.elementTypeMap.set(empty as T, 'Dyno');
      return [empty];
    }

    dynos.forEach((dyno) => {
      this.elementTypeMap.set(dyno as T, 'Dyno');
      this.childParentMap.set(dyno as T, parent);
    });
    const appResources = this.appToResourceMap.get(app);
    appResources!.dynos = dynos;
    return dynos;
  }

  /**
   * Gets the addons for the specified app id and
   * listens to property changes on each object returned.
   *
   * @param app The app to get addons for.
   * @param parent The parent element the AddOns belong to
   * @returns an array of Bindable<AddOn>
   */
  private async getAddonsForApp(app: App, parent: T): Promise<AddOn[]> {
    const { addOns: cachedAddOns } = this.appToResourceMap.get(app) ?? {};
    if (cachedAddOns?.length) {
      return cachedAddOns;
    }

    const addOns: AddOn[] = [
      {
        id: `${app.id}-addons-market`,
        app: {
          id: app.id
        },
        name: 'Search Elements Marketplace'
      } as AddOn
    ];
    try {
      const addons = await vscode.commands.executeCommand<AddOn[]>(ListAddOnsByApp.COMMAND_ID, app.id);
      addOns.push(...addons);
    } catch {
      // no-op
    }

    addOns.forEach((addOn) => {
      this.elementTypeMap.set(addOn as T, 'AddOn');
      this.childParentMap.set(addOn as T, parent);
    });
    const appResources = this.appToResourceMap.get(app)!;
    appResources.addOns = addOns;
    return addOns;
  }

  /**
   * Gets the categories for the settings section.
   *
   * @param app The app to get categories for.
   * @param parent The parent node that the categories belongs to.
   *
   * @returns vscode.TreeItem[]
   */
  private getSettingsCategories(app: App, parent: T): vscode.TreeItem[] {
    const { id: appIdentifier } = app;
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
   * Watches the git config for changes.
   */
  private async watchGitConfig(): Promise<void> {
    const appChanges = await vscode.commands.executeCommand<AsyncIterable<Set<string>>>(
      WatchConfig.COMMAND_ID,
      this.abortWatchGitConfig
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const appNames of appChanges) {
      this.apps.length = 0;
      this.fire(undefined);
    }
  }
}
