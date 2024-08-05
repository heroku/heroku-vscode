import { watch, stat, FileChangeInfo } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand } from '../../meta/command';

@herokuCommand()
/**
 * Command that creates a watcher for the .netrc file.
 */
export class WatchNetrc extends HerokuCommand<AsyncIterable<FileChangeInfo<string>>> {
  public static COMMAND_ID = 'heroku:watchnetrc' as const;

  /**
   * Finds the absolute path to the .netrc file
   * on disk based on the operating system. This
   * code was copied directly from `netrc-parser`
   * and optimized
   *
   * @see [netrc-parser](https://github.com/jdx/node-netrc-parser/blob/master/src/netrc.ts#L177)
   *
   * @returns the file path of the .netrc on disk.
   */
  protected static async getNetrcFileLocation(): Promise<string> {
    let home: string | undefined = '';
    if (os.platform() === 'win32') {
      home = process.env.HOME ?? (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE, process.env.HOMEPATH)) ?? process.env.USERPROFILE;
    }
    if (!home) {
      home = os.homedir() ?? os.tmpdir();
    }
    let file = path.join(home, os.platform() === 'win32' ? '_netrc' : '.netrc');

    try {
      await stat(file + '.gpg');
      return file += '.gpg';
    } catch {
      return file;
    }
  }

  /**
   * Create a file watcher for the .netrc file on disk.
   * This watcher is used to detect external changes
   * that occur from signing in or sining out of Heroku
   * outside of the extension. e.g. The user uses a
   * terminal to sign in or out.
   *
   * @param signal The abort signal used to stop the watcher.
   * @returns a Promise that resolves to an AsyncIterable which will contain file change info on each await.
   */
  public async run(signal: AbortSignal): Promise<AsyncIterable<FileChangeInfo<string>>> {
    const file = await WatchNetrc.getNetrcFileLocation();
    return watch(file, {signal});
  }
}
