import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vscode from 'vscode';
import { HerokuCommand } from '../commands/heroku-command';
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

/**
 * Checks if encryption is available on this system via gpg.
 *
 * @returns boolean indicating if encryption is available on this system
 */
export async function canEncrypt(): Promise<boolean> {
  try {
    const result = await HerokuCommand.waitForCompletion(HerokuCommand.exec('gpg --version'));
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Retrieves the entire contents of the netrc file
 * in an unencrypted string.
 *
 * @returns A promise resolving to the netrc file contents or null
 */
export async function getNetRcContents(): Promise<string | null> {
  const file = await getNetrcFileLocation();
  if (!file) {
    return null;
  }
  let netrcContents: string;
  if (file.endsWith('.gpg')) {
    const gpgProcess = HerokuCommand.exec(`gpg --batch --quiet --decrypt ${file}`);
    const { exitCode, output } = await HerokuCommand.waitForCompletion(gpgProcess);
    if (exitCode !== 0) {
      return null;
    }
    netrcContents = output;
  } else {
    const netRcBuffer = await vscode.workspace.fs.readFile(vscode.Uri.parse(file));
    netrcContents = netRcBuffer.toString();
  }
  return netrcContents;
}

/**
 * Finds the line number of the password entry in the netrc file for heroku.
 *
 * @param lines the unencrypted array of strings representing the lines of the netrc file
 * @returns the line number of the password entry in the netrc file
 */
export function findPasswordLineNumber(lines: string[]): number {
  const machineIndex = lines.findIndex((line) => line.trim() === 'machine api.heroku.com');
  if (machineIndex === -1) {
    return -1;
  }

  // Look for password in subsequent lines until we hit another machine or end
  for (let i = machineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('machine')) {
      break;
    }
    if (line.startsWith('password')) {
      return i;
    }
  }
  return -1;
}
