import path from 'node:path';
import { exec as execProcess } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
const exec = promisify(execProcess);

/**
 * Finds the git config file location and returns it
 * or undefined if not found.
 *
 * @returns string
 */
export async function findGitConfigFileLocation(): Promise<string> {
  const [ws] = vscode.workspace.workspaceFolders ?? [];
  const { stdout, stderr } = await exec('git rev-parse --git-dir', { cwd: ws?.uri.path ?? '.' });
  if (stderr) {
    throw new Error(stderr);
  }
  const configPath = path.join(ws.uri.path, stdout.trim(), 'config');
  return configPath;
}

/**
 * Gets an array of Heroku app names from the git remotes or
 * an empty array if no Heroku apps were found.
 *
 * @returns string[] An array of app names derived from the git remotes.
 */
export async function getHerokuAppNames(): Promise<string[]> {
  const [ws] = vscode.workspace.workspaceFolders ?? [];
  const { stdout, stderr } = await exec('git remote -v', { cwd: ws?.uri.path ?? '.' });
  if (stderr) {
    throw new Error(stderr);
  }
  const lines = stdout.trim().split('\n');
  const remotes = lines.map((line) => line.trim().split(/\s+/)).map(([name, url, kind]) => ({ name, url, kind }));
  const herokuRemotes = remotes.filter((remote) => remote.name.includes('heroku') && !!remote.url?.includes('heroku'));

  const appNames = new Set<string>();
  for (const herokuRemote of herokuRemotes ?? []) {
    const { url } = herokuRemote;
    if (!URL.canParse(url)) {
      continue;
    }
    const { pathname } = new URL(url);
    appNames.add(pathname.replaceAll(/(\/|.git)/g, ''));
  }
  return Array.from(appNames.values());
}
