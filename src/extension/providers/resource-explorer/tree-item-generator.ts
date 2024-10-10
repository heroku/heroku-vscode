import { AddOn, App, Dyno, Formation } from '@heroku-cli/schema';
import * as vscode from 'vscode';
import { ShowAddonsViewCommand } from '../../commands/add-on/show-addons-view';
import { dynoIconsBySize } from './dyno-icons-by-size';

/**
 * Consumes a Formation object and returns a TreeItem
 *
 * @param context The extension context
 * @param formation The Formation to convert to a tree item.
 * @returns The TreeItem from the specified Formation
 */
export function getFormationTreeItem(context: vscode.ExtensionContext, formation: Formation): vscode.TreeItem {
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
    iconPath: context.asAbsolutePath('/resources/formation-icon-16.png'),
    contextValue
  } as vscode.TreeItem;
}

/**
 * Consumes an App object and returns a TreeItem.
 *
 * @param context The extension context
 * @param app The App to convert to a TreeItem.
 * @param logSessionMuted Whether the log session is muted or not.
 * @returns The TreeItem from the specified Dyno
 */
export function getAppTreeItem(context: vscode.ExtensionContext, app: App, logSessionMuted: boolean): vscode.TreeItem {
  return {
    id: app.id,
    label: app.name,
    description: app.buildpack_provided_description ?? '',
    tooltip: `${app.name} - ${app.organization?.name ?? app.team?.name ?? app.owner.email}`,
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    contextValue: logSessionMuted ? 'heroku:app' : 'heroku:app:log-session-started',
    iconPath: context.asAbsolutePath('/resources/app-28.png')
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
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    },
    {
      id: appIdentifier + ':dynos',
      label: 'DYNOS',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    },
    {
      id: appIdentifier + ':addons',
      label: 'ADD-ONS',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    },
    {
      id: appIdentifier + ':settings',
      label: 'SETTINGS',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    }
  ];
}

/**
 * Consumes an AddOn object and returns a TreeItem.
 *
 * @param context The extension context
 * @param addOn The AddOn to convert to a TreeItem
 * @param categoryNode The parent node of the add-on
 * @returns The TreeItem from the specified Dyno
 */
export async function getAddOnTreeItem(
  context: vscode.ExtensionContext,
  addOn: AddOn,
  categoryNode: vscode.TreeItem
): Promise<vscode.TreeItem> {
  if (addOn.name === 'Search Elements Marketplace') {
    return {
      id: addOn.id,
      label: addOn.name,
      iconPath: context.asAbsolutePath('/resources/marketing-addon-48.png'),
      command: {
        command: ShowAddonsViewCommand.COMMAND_ID,
        title: 'Find more add-ons',
        arguments: [addOn.app.id, context.extensionUri, categoryNode]
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

/**
 * Consumes a Dyno object and returns a TreeItem.
 *
 * @param context The extension context
 * @param dyno The Dyno to convert to a TreeItem
 * @returns The TreeItem from the specified Dyno
 */
export function getDynoTreeItem(context: vscode.ExtensionContext, dyno: Dyno): vscode.TreeItem {
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
    iconPath: getDynoIconPath(context, dyno),
    tooltip: `${dyno.app.name} - ${dyno.size}`,
    contextValue: `dyno:${dyno.state}`
  } as vscode.TreeItem;
}

/**
 * Gets the icon path for the specified Dyno
 *
 * @param context The extension context
 * @param dyno The Dyno to get the icon for
 * @returns string The path of the dyno icon
 */
function getDynoIconPath(context: vscode.ExtensionContext, dyno: Dyno): string | vscode.ThemeIcon {
  if (dyno.state === 'starting') {
    return new vscode.ThemeIcon('loading~spin');
  }
  return context.asAbsolutePath(dynoIconsBySize[dyno.size as keyof typeof dynoIconsBySize]);
}
