import { EventEmitter } from 'node:events';
import AppService from '@heroku-cli/schema/services/app-service.js';
import type { AddOn, App, Dyno, Formation } from '@heroku-cli/schema';
import DynoService from '@heroku-cli/schema/services/dyno-service.js';
import vscode, { Uri } from 'vscode';

import FormationService from '@heroku-cli/schema/services/formation-service.js';
import { diff } from '../../utils/diff';
import { ListAddOnsByApp } from '../../commands/add-on/list-by-app';
import type { LogSessionStream } from '../../commands/app/context-menu/start-log-session';
import { getHerokuAppNames, getRootRepository } from '../../utils/git-utils';
import { logExtensionEvent } from '../../utils/logger';
import { generateRequestInit } from '../../utils/generate-service-request-init';
import {
  LogStreamClient,
  LogStreamEvents,
  type StartingProcessInfo,
  type ScaledToInfo,
  type StateChangedInfo,
  AttachmentProvisionedInfo,
  AttachmentDetachedInfo
} from './log-stream-client';
import {
  getAddOnTreeItem,
  getAppCategories,
  getAppTreeItem,
  getDynoTreeItem,
  getFormationTreeItem,
  getSettingsCategories
} from './tree-item-generator';

// Commands used in quick access menus
import '../../commands/app/context-menu/start-log-session';
import '../../commands/app/context-menu/open-app';
import '../../commands/app/context-menu/open-settings';
import '../../commands/app/context-menu/end-log-session';
import '../../commands/app/context-menu/remove-from-workspace';
import '../../commands/dyno/scale-formation';
import '../../commands/dyno/restart-dyno';

type AppDiffs = { added: Set<string>; removed: Set<string> };
/**
 * Represents an App that can have a LogSession
 */
type LogSessionCapableApp = App & { logSession?: LogSessionStream | undefined };
/**
 * Represents the possible types of data that can be displayed in the Heroku Resource Explorer tree view.
 */
type ExtendedTreeDataTypes = LogSessionCapableApp | Dyno | Formation | AddOn | vscode.TreeItem;
/**
 * Represents the resources associated with an App.
 */
type AppResources = { dynos: Dyno[]; formations: Formation[]; addOns: AddOn[]; categories: vscode.TreeItem[] };
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

  protected apps: Map<App['name'], App> = new Map();
  protected appToResourceMap = new WeakMap<App, AppResources>();

  protected elementTypeMap = new WeakMap<T, 'App' | 'Dyno' | 'AddOn' | 'Formation'>();
  protected childParentMap = new WeakMap<T, T>();

  protected watchGitConfigDisposable: vscode.Disposable | undefined;
  protected syncAddonsPending = false;
  protected readonly persistentStateLocation: Uri;

  /**
   * Bi-directional emitter used to maintain
   * sync between the webview and the explorer.
   */
  protected addonsViewEmitter = new EventEmitter();

  #logStreamClient!: LogStreamClient;

  /**
   * Constructs a new HerokuResourceExplorerProvider
   *
   * @param context The ExtensionContext provided by VSCode
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
    this.addonsViewEmitter.on('addonCreated', this.onAddonCreated);
    this.persistentStateLocation = Uri.joinPath(context.globalStorageUri, 'heroku-apps.json');
    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions(this.reSyncAllApps),
      vscode.commands.registerCommand('heroku:sync-with-dashboard', this.reSyncAllApps)
    );
  }

  /**
   * Gets the LogStreamClient creating it and attaching
   * listeners if it wasn't previously defined.
   *
   * @returns The LogStreamClient
   */
  private get logStreamClient(): LogStreamClient {
    if (!this.#logStreamClient) {
      this.#logStreamClient = new LogStreamClient();
      this.#logStreamClient.addListener(LogStreamEvents.SCALED_TO, this.onFormationScaledTo);
      this.#logStreamClient.addListener(LogStreamEvents.STATE_CHANGED, this.onDynoProcessStartingOrStateChanged);
      this.#logStreamClient.addListener(LogStreamEvents.STARTING_PROCESS, this.onDynoProcessStartingOrStateChanged);
      this.#logStreamClient.addListener(LogStreamEvents.PROVISIONING_COMPLETED, this.onAttachmentProvisioned);
      this.#logStreamClient.addListener(LogStreamEvents.ATTACHMENT_DETACHED, this.onAttachmentDetached);

      this.#logStreamClient.addListener(LogStreamEvents.MUTED_CHANGED, this.onStreamMutedChanged);
    }
    return this.#logStreamClient;
  }

  /**
   * @inheritdoc
   */
  public async getTreeItem(element: T): Promise<vscode.TreeItem> {
    switch (this.elementTypeMap.get(element)) {
      case 'AddOn':
        return getAddOnTreeItem(this.context, element as AddOn, this.addonsViewEmitter);

      case 'App': {
        const app = element as LogSessionCapableApp;
        return getAppTreeItem(app, !app.logSession || !!app.logSession?.muted);
      }

      case 'Dyno':
        return getDynoTreeItem(element as Dyno);

      case 'Formation':
        return getFormationTreeItem(element as Formation);

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

          case 'SETTINGS': {
            const categories = getSettingsCategories(app);
            categories.forEach((cat) => this.childParentMap.set(cat as T, element));
            return categories as T[];
          }

          default:
            return [];
        }
      }
      return [];
    } else {
      // Initialize the last state of the explorer
      // and schedule a full sync of apps from the git config.
      try {
        const state = await vscode.workspace.fs.readFile(this.persistentStateLocation);
        const appStateJson = JSON.parse(state.toString()) as Array<[string, App]>;
        this.apps = new Map(appStateJson);
        this.apps.forEach((app) => {
          this.elementTypeMap.set(app as T, 'App');
          this.appToResourceMap.set(app, { dynos: [], formations: [], addOns: [], categories: [] });
        });
        this.logStreamClient.apps = Array.from(this.apps.values());
      } catch {
        // noop
      }

      void this.watchGitConfig();
    }

    return Array.from(this.apps.values()) as T[];
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.watchGitConfigDisposable?.dispose();
    this.watchGitConfigDisposable = undefined;
  }

  /**
   * Event handler for Dyno scale events.
   *
   * @param data The data dispatched when a Dyno scale occurs.
   */
  private onFormationScaledTo = (data: ScaledToInfo): void => {
    const { app, quantity, size } = data;
    const { formations, categories } = this.appToResourceMap.get(app)!;
    const formation = formations.find((f) => f.size === size);
    if (formation) {
      Reflect.set(formation, 'quantity', quantity);
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
   * Synchronizes the add-ons for the specified app.
   *
   * @param app The app to synchronize add-ons for
   * @param knownAddon An optional addon to synchronize
   */
  private async queueAddOnSynchronization(app: App, knownAddon?: AddOn): Promise<void> {
    if (this.syncAddonsPending) {
      return;
    }
    this.syncAddonsPending = true;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for log chatter to settle a bit
    const { addOns, categories } = this.appToResourceMap.get(app)!;
    const addonsSet = new Set(addOns.map((a) => a.id));

    addOns.length = 0;
    const addOnsCategory = categories.find((cat) => cat.label === 'ADD-ONS');
    // Repopulates `addOns`
    const pristineAddons = await this.getAddonsForApp(app, addOnsCategory as T);
    if (knownAddon && !pristineAddons.find((a) => a.name === knownAddon.name)) {
      pristineAddons.push(knownAddon);
    }
    const pristineAddonsSet = new Set(pristineAddons.map((a) => a.id));

    // Sync properties
    addonsSet.forEach((id) => {
      if (pristineAddonsSet.has(id)) {
        const addon = addOns.find((a) => a.id === id);
        const pristineAddon = pristineAddons.find((a) => a.id === id);
        if (addon && pristineAddon) {
          Object.assign(addon, pristineAddon);
          this.fire(addon as T);
        }
      }
    });
    const { added, removed } = diff(addonsSet, pristineAddonsSet);
    if (added.size || removed.size) {
      this.fire(addOnsCategory as T);
      this.addonsViewEmitter.emit('installedAddOnsChanged');
    }
    this.syncAddonsPending = false;
  }

  /**
   * Handler triggered when an addon was created
   * in the Elements Marketplace webview.
   *
   * @param addon The addon that was created
   */
  private onAddonCreated = (addon: AddOn): void => {
    const app = this.apps.get(addon.app.name)!;
    void this.queueAddOnSynchronization(app, addon);
  };

  /**
   * Handler for the dyno process starting event.
   *
   * @param data The data dispatched when a dyno is starting
   * @param retryCount The number of times to retry fetching a dyno from the API before giving up
   */
  private onDynoProcessStartingOrStateChanged = (
    data: StartingProcessInfo | StateChangedInfo,
    retryCount = 5
  ): void => {
    const { app, dynoName } = data;
    const dynos = this.appToResourceMap.get(app)!.dynos;
    let dyno = dynos.find((d) => d.name === dynoName);

    if (!dyno) {
      void (async (): Promise<void> => {
        try {
          dyno = await this.dynoService.info(app.id, dynoName, await generateRequestInit());
        } catch {
          // Dynos that are newly provisioning are 404
          // for a little while on some formations...not sure why.
          if (retryCount > 0) {
            setTimeout(() => void this.onDynoProcessStartingOrStateChanged(data, retryCount - 1), 1000);
          }
          // 404, 401
          return;
        }
        // Logs do not stream in order sometimes
        // and dyno names are recycled while dyno
        // id's are not. This means we could get a
        // dyno that has already been added. Check
        // if we have a dyno with the same name and
        // id and update it. Otherwise, add it.
        const maybeExistingDyno = dynos.find((d) => d.name === dyno?.name);
        if (maybeExistingDyno) {
          Object.assign(maybeExistingDyno, dyno);
        } else {
          dynos.push(dyno);
        }
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
      const state = 'to' in data ? data.to : 'starting';
      Reflect.set(dyno, 'state', state);
      this.fire(dyno as T);
      // Not all add-on vendors use the Heroku-provided
      // log drain to write provisioning/deprovisioning
      // logs. Since Dynos are restarted with *most* changes
      // to an add-on, we must check for add-ons being
      // provisioned/deprovisioned when dynos restart.
      void this.queueAddOnSynchronization(app);
      // down scaling will shut down Dynos which cannot be restarted.
      // These dynos need to be removed since they are no longer valid
      // but we want to display the visual indicator to the user that they have
      // been successfully stopped which occurs in the onDynoStateChanged.
      if (state === 'down') {
        // Does this dyno need to be removed?
        void (async (): Promise<void> => {
          try {
            await this.dynoService.info(app.id, dynoName, await generateRequestInit());
          } catch {
            // not found - remove it
            const idx = dynos.findIndex((d) => d.name === dynoName);
            if (idx > -1) {
              dynos.splice(idx, 1);
              const dynosCategory = this.appToResourceMap.get(app)!.categories.find((cat) => cat.label === 'DYNOS');
              this.fire(dynosCategory as T);
            }
          }
        })();
      }
    }
  };

  /**
   * Handler for when attachments complete provisioning
   *
   * @param data The data dispatched when the attachment completes provisioning
   */
  private onAttachmentProvisioned = (data: AttachmentProvisionedInfo): void => {
    const { app, ref } = data;
    const { addOns } = this.appToResourceMap.get(app)!;
    if (addOns) {
      const addOn = addOns.find((a) => a.name === ref);
      if (addOn) {
        Reflect.set(addOn, 'state', 'provisioned');
        this.fire(addOn as T);
      } else {
        void this.queueAddOnSynchronization(app);
      }
    }
  };

  /**
   * Handler for when attachments are detached
   *
   * @param data The data dispatched when the attachment detaches
   */
  private onAttachmentDetached = (data: AttachmentDetachedInfo): void => {
    void this.queueAddOnSynchronization(data.app);
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
      'OK'
    );

    if (response === 'View apps') {
      void vscode.env.openExternal(vscode.Uri.parse('https://dashboard.heroku.com/apps'));
    }
  }

  /**
   * Get the Formations for the specified app and subscribes
   * to property changes on each object returned.
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
    const formations = await this.formationService.list(app.id, await generateRequestInit());
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
   * to property changes on each object returned.
   *
   * @param app The app to get dynos for.
   * @param parent The parent element the dyno tree items will belong to.
   * @returns An array of Bindable<Dyno>.
   */
  private async getDynosForApp(app: App, parent: T): Promise<Dyno[]> {
    const { dynos: cachedDynos } = this.appToResourceMap.get(app) ?? {};
    if (cachedDynos?.length) {
      return cachedDynos;
    }

    const dynos = await this.dynoService.list(app.id, await generateRequestInit());
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
          id: app.id,
          name: app.name
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
   * Watches the git config for changes.
   */
  private async watchGitConfig(): Promise<void> {
    if (this.watchGitConfigDisposable) {
      return;
    }
    let apps: Set<string> = new Set(await getHerokuAppNames());
    const rootRepository = await getRootRepository();

    this.watchGitConfigDisposable = rootRepository?.state.onDidChange(async () => {
      const maybeChangedApps = new Set(await getHerokuAppNames());
      const { added, removed } = diff(apps, maybeChangedApps);

      if (added.size || removed.size) {
        apps = maybeChangedApps;
        logExtensionEvent('Git config changed: syncing apps');
        await this.syncApps({ added, removed });
      }
    });

    await this.syncApps({ added: apps, removed: new Set() });

    const state = JSON.stringify(Array.from(this.apps.entries()));
    await vscode.workspace.fs.writeFile(this.persistentStateLocation, Buffer.from(state));
  }

  /**
   * Syncs the apps based on the provided app diffs.
   *
   * @param appDiffs The app diffs to sync
   * @returns Promise<void>
   */
  private async syncApps(appDiffs: AppDiffs): Promise<void> {
    const session = await vscode.authentication.getSession('heroku:auth:login', []);
    await this.deleteState();

    if (!session?.accessToken) {
      logExtensionEvent('Cannot sync apps: session is unavailable');
      // Only do this if we have apps else it will
      // be an infinite async loop.
      if (this.apps.size) {
        this.apps.clear();
        this.logStreamClient.apps = [];
        this.fire(undefined);
      }
      return;
    }

    const { added, removed } = appDiffs;
    if (added.size) {
      let appsNotFound = [];
      const addedArray = Array.from(added).filter((appName) => !this.apps.has(appName));
      const requestInit = await generateRequestInit(undefined, session.accessToken);
      const appResults = await Promise.allSettled(
        addedArray.map((appName) => this.appService.info(appName, requestInit))
      );
      for (let i = 0; i < appResults.length; i++) {
        const result = appResults[i];
        if (result.status === 'fulfilled') {
          const app = result.value;
          this.apps.set(app.name ?? '', app);
          this.elementTypeMap.set(app as T, 'App');
          this.appToResourceMap.set(app, { dynos: [], formations: [], addOns: [], categories: [] });
        } else {
          appsNotFound.push(addedArray[i]);
          logExtensionEvent(`App not found: ${addedArray[i]}`);
        }
      }
      appsNotFound = appsNotFound.filter((name: string) => !this.apps.has(name));
      if (appsNotFound.length) {
        void this.showAppsNotFound(appsNotFound);
      }
    }
    if (removed.size) {
      removed.forEach((appName) => this.apps.delete(appName));
    }
    this.logStreamClient.apps = Array.from(this.apps.values());
    if (added.size || removed.size) {
      this.fire(undefined);
    }

    const logMessage = this.apps.size
      ? `Displaying ${Array.from(this.apps.values())
          .map((a) => a.name)
          .join(', ')} in TreeView`
      : 'No apps found';
    logExtensionEvent(logMessage);

    await vscode.commands.executeCommand('setContext', 'heroku:get:started', !this.apps.size);
  }

  /**
   * Force the resource explorer to re-retrieve all app data.
   */
  private reSyncAllApps = (): void => {
    logExtensionEvent('Re-syncing all apps');
    this.logStreamClient.apps = [];
    this.watchGitConfigDisposable?.dispose();
    this.watchGitConfigDisposable = undefined;
    this.apps.clear();
    void vscode.commands.executeCommand('setContext', 'heroku:get:started', false);
    void this.watchGitConfig();
  };

  /**
   * Deletes the state file containing the apps.
   *
   * @returns Promise<void>
   */
  private async deleteState(): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.persistentStateLocation, { recursive: true, useTrash: false });
    } catch {
      // no-op
    }
  }
}
