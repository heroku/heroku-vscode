import { watch, stat, FileChangeInfo } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HerokuCommand } from '../heroku-command';
import { herokuCommand } from '../../meta/command';

@herokuCommand
export class WatchNetrc extends HerokuCommand<AsyncIterable<FileChangeInfo<string>>> {
  public static COMMAND_ID = 'heroku:watchnetrc' as const;

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

  public async run(signal: AbortSignal): Promise<AsyncIterable<FileChangeInfo<string>>> {
    const file = await WatchNetrc.getNetrcFileLocation();
    return watch(file, {signal});
  }
}
