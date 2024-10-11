import { watch } from 'node:fs/promises';
import * as vscode from 'vscode';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import { findGitConfigFileLocation, getHerokuAppNames } from '../../utils/git-utils';

export type GitRemoteAppsDiff = { added: Set<string>; removed: Set<string> };
@herokuCommand()
/**
 * The WatchConfig command watches the git config
 * file for changes and yields the diff.
 */
export class WatchConfig extends HerokuCommand<AsyncGenerator<GitRemoteAppsDiff>> {
  public static COMMAND_ID = 'heroku:watch:config';

  /**
   * Runs the command.
   *
   * @param abortController AbortController
   * @param updateContext boolean
   *
   * @returns AsyncGenerator<AppNameDiff>
   */
  public async run(abortController: AbortController, updateContext = true): Promise<AsyncGenerator<GitRemoteAppsDiff>> {
    const configPath = await findGitConfigFileLocation();
    let apps = new Set(await this.getUpdatedAppNames(updateContext));

    return async function* (this: WatchConfig): AsyncGenerator<GitRemoteAppsDiff> {
      while (!abortController.signal.aborted) {
        const watcher = watch(configPath, { signal: abortController.signal });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const event of watcher) {
          const maybeUpdatedApps = new Set(await this.getUpdatedAppNames(updateContext));
          const added = maybeUpdatedApps.difference(apps);
          const removed = apps.difference(maybeUpdatedApps);
          if (added.size || removed.size) {
            apps = maybeUpdatedApps;
            yield { added, removed };
          }
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }.bind(this)();
  }

  /**
   * Gets the updated app names and optionally updates the 'heroku.app-found' context.
   *
   * @param updateContext boolean indicatig whether to update the 'heroku.app-found' context.
   * @returns Promise<Set<string>>
   */
  private async getUpdatedAppNames(updateContext: boolean): Promise<Set<string>> {
    const apps = new Set(await getHerokuAppNames());
    if (updateContext) {
      void vscode.commands.executeCommand('setContext', 'heroku.app-found', !!apps.size);
    }
    return apps;
  }
}
