import type { App } from '@heroku/types/3.sdk';
import vscode from 'vscode';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import { createHerokuSDK } from '../../utils/heroku-sdk';
import { DeployToHeroku } from './deploy-to-heroku';

type PickItem = vscode.QuickPickItem & { value?: string };

@herokuCommand()
/**
 * Links an app to the current workspace.
 *
 * Usage:
 * ```typescript
 * await vscode.commands.executeCommand(LinkApp.COMMAND_ID);
 * ```
 */
export class LinkApp extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:link-app-to-sources' as const;

  /**
   * @inheritDoc
   */
  public async run(): Promise<void> {
    const thenable = (async (): Promise<PickItem[]> => {
      const sdk = await createHerokuSDK(this.signal);
      // Heroku's /apps endpoint paginates at 200 by default; bump the
      // page size so accounts with more apps don't see silent
      // truncation. SDK-side pagination is the proper fix (W-22717723).
      const apps = await sdk.platform.withOptions({ headers: { Range: 'name ..; max=1000;' } }).app.list();
      const appsByTeam = this.mapAppsByTeam(apps);
      const items = [] as PickItem[];

      if (!apps.length) {
        return [
          {
            iconPath: new vscode.ThemeIcon('hk-icon-add-16'),
            label: 'Create and deploy a new app',
            description: 'Create and deploy a new app to Heroku'
          }
        ];
      }

      for (const [teamName, teamApps] of appsByTeam) {
        // Separator
        items.push({
          label: teamName,
          kind: vscode.QuickPickItemKind.Separator
        });
        // Apps in this team
        items.push(
          ...teamApps.map(
            (app: App) =>
              ({
                iconPath: app.space?.shield
                  ? new vscode.ThemeIcon('hk-icon-space-shielded-16')
                  : new vscode.ThemeIcon('hk-icon-apps-16'),
                label: app.name,
                description: app.team?.name ?? 'Personal',
                value: app.name
              }) as PickItem
          )
        );
      }

      return items;
    })();

    const selected = await vscode.window.showQuickPick<PickItem>(thenable, { canPickMany: true });
    if (!selected) {
      return;
    }

    for (const item of selected) {
      if (!item.value) {
        await vscode.commands.executeCommand(DeployToHeroku.COMMAND_ID);
      }
      const flags = new Map([['remote', `heroku-${item.value}`]]);
      await vscode.commands.executeCommand(
        'heroku:user:git:remote',
        { id: item.value, name: item.value },
        undefined,
        flags
      );
    }
  }
  /**
   * Maps apps by team name
   *
   * @param apps The array of apps to map by team
   * @returns A map of apps by team
   */
  private mapAppsByTeam(apps: App[]): Map<string, App[]> {
    const teams = new Map<string, App[]>();
    apps.sort((a: App, b: App) => {
      const name = (a.name ?? '').localeCompare(b.name ?? '');
      const teamName = (a.team?.name ?? 'aaaa').localeCompare(b.team?.name ?? 'aaaa');

      return teamName ?? name;
    });
    for (const app of apps) {
      const teamName = app.team?.name ?? 'Personal';
      const teamApps = teams.get(teamName) ?? [];
      teamApps.push(app);
      teams.set(teamName, teamApps);
    }
    return teams;
  }
}
