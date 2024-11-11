import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
export async function getNetrcFileLocation(): Promise<string> {
  let home: string | undefined = '';
  if (os.platform() === 'win32') {
    home =
      process.env.HOME ??
      (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE, process.env.HOMEPATH)) ??
      process.env.USERPROFILE;
  }
  if (!home) {
    home = os.homedir() ?? os.tmpdir();
  }
  let file = path.join(home, os.platform() === 'win32' ? '_netrc' : '.netrc');

  try {
    await stat(file + '.gpg');
    return (file += '.gpg');
  } catch {
    return file;
  }
}
