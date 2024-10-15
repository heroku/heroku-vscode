import { watch } from 'node:fs/promises';
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
   *
   * @returns AsyncGenerator<AppNameDiff>
   */
  public async run(abortController: AbortController): Promise<AsyncGenerator<GitRemoteAppsDiff>> {
    const configPath = await findGitConfigFileLocation();
    let apps = new Set(await getHerokuAppNames());

    return async function* (this: WatchConfig): AsyncGenerator<GitRemoteAppsDiff> {
      yield { added: apps, removed: new Set() };
      while (!abortController.signal.aborted) {
        const watcher = watch(configPath, { signal: abortController.signal });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const event of watcher) {
          const maybeUpdatedApps = new Set(await getHerokuAppNames());
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
}
