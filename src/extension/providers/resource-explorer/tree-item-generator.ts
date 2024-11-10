import EventEmitter from 'node:events';
import { AddOn, App, Dyno, Formation } from '@heroku-cli/schema';
import * as vscode from 'vscode';
import { ShowAddonsViewCommand } from '../../commands/add-on/show-addons-view';
import { dynoIconsBySize } from '../../utils/dyno-icons-by-size';

/**
 * Consumes a Formation object and returns a TreeItem
 *
 * @param formation The Formation to convert to a tree item.
 * @returns The TreeItem from the specified Formation
 */
export function getFormationTreeItem(formation: Formation): vscode.TreeItem {
  const canIncreaseDynoCount =
    (!/(Free|Eco|Hobby|Basic|)/.test(formation.size) && formation.quantity < 100) || !formation.quantity;
  let contextValue = `heroku:formation`;
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
    iconPath: new vscode.ThemeIcon('hk-icon-formation-16', new vscode.ThemeColor('hk.purple.2')),
    contextValue,
    resourceUri: vscode.Uri.parse(`heroku:/formation/${formation.size}`)
  } as vscode.TreeItem;
}

/**
 * Consumes an App object and returns a TreeItem.
 *
 * @param app The App to convert to a TreeItem.
 * @param logSessionMuted Whether the log session is muted or not.
 * @returns The TreeItem from the specified Dyno
 */
export function getAppTreeItem(app: App, logSessionMuted: boolean): vscode.TreeItem {
  return {
    id: app.id,
    label: app.name,
    description: app.buildpack_provided_description ?? '',
    tooltip: `${app.name} - ${app.organization?.name ?? app.team?.name ?? app.owner.email}`,
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    contextValue: logSessionMuted ? 'heroku:app' : 'heroku:app:log-session-started',
    iconPath: new vscode.ThemeIcon('hk-icon-app-16', new vscode.ThemeColor('hk.purple'))
  } as vscode.TreeItem;
}

/**
 * Gets the main tree nodes for the resource explorer.
 *
 * @param appIdentifier The app id or name.
 * @returns an array of TreeItem.
 */
export function getAppCategories(appIdentifier: string): vscode.TreeItem[] {
  return [
    {
      id: appIdentifier + ':formations',
      label: 'FORMATIONS',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      resourceUri: vscode.Uri.parse(`heroku:/category/formations`)
    },
    {
      id: appIdentifier + ':dynos',
      label: 'DYNOS',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      resourceUri: vscode.Uri.parse(`heroku:/category/dynos`)
    },
    {
      id: appIdentifier + ':addons',
      label: 'ADD-ONS',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      resourceUri: vscode.Uri.parse(`heroku:/category/add-ons`)
    },
    {
      id: appIdentifier + ':settings',
      label: 'SETTINGS',
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      resourceUri: vscode.Uri.parse(`heroku:/category/settings`)
    }
  ];
}

const iconUrls: Record<string, string> = {};
/**
 * Consumes an AddOn object and returns a TreeItem.
 *
 * @param context The extension context
 * @param addOn The AddOn to convert to a TreeItem
 * @param notifier The event emitter to notify when the add-on is added
 * @returns The TreeItem from the specified Dyno
 */
export async function getAddOnTreeItem(
  context: vscode.ExtensionContext,
  addOn: AddOn,
  notifier: EventEmitter
): Promise<vscode.TreeItem> {
  if (addOn.name === 'Search Elements Marketplace') {
    return {
      id: addOn.id,
      label: addOn.name,
      iconPath: new vscode.ThemeIcon('hk-icon-search-16'),
      command: {
        command: ShowAddonsViewCommand.COMMAND_ID,
        title: 'Find more add-ons',
        arguments: [addOn.app.id, context.extensionUri, notifier]
      }
    };
  }
  // Grab the icon from https://addons.heroku.com
  let iconUrl: string = iconUrls[addOn.addon_service.id];
  if (!iconUrl) {
    try {
      const addonsApiResponse = await fetch(`https://addons.heroku.com/api/v2/addons/${addOn.addon_service.id}`);
      const json = (await addonsApiResponse.json()) as { addon: { icon_url: string } };
      iconUrl = URL.canParse(json.addon.icon_url)
        ? json.addon.icon_url
        : `https://addons.heroku.com/${json.addon.icon_url}`;
      iconUrls[addOn.addon_service.id] = iconUrl;
    } catch {
      // no-op - don't worry, this won't break things too badly.
    }
  }

  return {
    id: addOn.id,
    label: addOn.addon_service.name,
    description: `- ${addOn.state}`,
    tooltip: `${addOn.name}`,
    iconPath: addOn.state === 'provisioning' ? new vscode.ThemeIcon('loading~spin') : vscode.Uri.parse(iconUrl),
    contextValue: `heroku:addon:${addOn.addon_service.name}`,
    resourceUri: vscode.Uri.parse(`heroku:/addon/${addOn.addon_service.name}`)
  } as vscode.TreeItem;
}

/**
 * Consumes a Dyno object and returns a TreeItem.
 *
 * @param dyno The Dyno to convert to a TreeItem
 * @returns The TreeItem from the specified Dyno
 */
export function getDynoTreeItem(dyno: Dyno): vscode.TreeItem {
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
    iconPath: getDynoIconPath(dyno),
    tooltip: `${dyno.app.name} - ${dyno.size}`,
    contextValue: `heroku:dyno:${dyno.state}`,
    resourceUri: vscode.Uri.parse(`heroku:/dyno/${dyno.state}`)
  } as vscode.TreeItem;
}

/**
 * Gets the categories for the settings section.
 *
 * @param app The app to get categories for.
 * @returns vscode.TreeItem[]
 */
export function getSettingsCategories(app: App): vscode.TreeItem[] {
  const { id: appIdentifier } = app;
  return [
    {
      id: appIdentifier + ':app-info',
      label: 'App Information',
      iconPath: new vscode.ThemeIcon('hk-icon-info-ring-16', new vscode.ThemeColor('hk.blue'))
    },
    {
      id: appIdentifier + ':config-vars',
      label: 'Config Vars',
      iconPath: new vscode.ThemeIcon('hk-icon-addon-config-16', new vscode.ThemeColor('hk.blue'))
    },
    {
      id: appIdentifier + ':buildpacks',
      label: 'Buildpacks',
      iconPath: new vscode.ThemeIcon('hk-icon-buildpack-16', new vscode.ThemeColor('hk.purple'))
    },
    {
      id: appIdentifier + ':ssl-certs',
      label: 'SSL Certificates',
      iconPath: new vscode.ThemeIcon('hk-icon-lock-locked-16', new vscode.ThemeColor('hk.green'))
    },
    {
      id: appIdentifier + ':domains',
      label: 'Domains',
      iconPath: new vscode.ThemeIcon('hk-icon-network-16', new vscode.ThemeColor('hk.blue'))
    }
  ] as vscode.TreeItem[];
}

/**
 * Gets the icon path for the specified Dyno
 *
 * @param dyno The Dyno to get the icon for
 * @returns string The path of the dyno icon
 */
function getDynoIconPath(dyno: Dyno): string | vscode.ThemeIcon {
  if (/^(starting|stopping|provisioning)$/.test(dyno.state)) {
    return new vscode.ThemeIcon('loading~spin');
  }
  return dynoIconsBySize[dyno.size];
}
