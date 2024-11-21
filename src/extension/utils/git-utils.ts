import path from 'node:path';
import { exec as execProcess } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { API, GitExtension, Repository } from '../git';
import { logExtensionEvent } from './logger';
const exec = promisify(execProcess);

/**
 * Finds the git config file location and returns it
 * or undefined if not found.
 *
 * @returns string
 */
export async function findGitConfigFileLocation(): Promise<string> {
  const [ws] = vscode.workspace.workspaceFolders ?? [];
  const cwd = ws?.uri.path ?? '.';
  const { stdout, stderr } = await exec('git rev-parse --git-dir', { cwd });
  if (stderr) {
    throw new Error(stderr);
  }
  const configPath = path.join(cwd, stdout.trim(), 'config');
  return configPath;
}

/**
 * Gets an array of Heroku app names from the git remotes or
 * an empty array if no Heroku apps were found.
 *
 * @returns string[] An array of app names derived from the git remotes.
 */
export async function getHerokuAppNames(): Promise<string[]> {
  let ws: vscode.WorkspaceFolder | undefined;
  while (!ws) {
    [ws] = vscode.workspace.workspaceFolders ?? [];
    if (ws) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
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

/**
 * Gets the git extension api. If it is not installed,
 * it will be installed.
 *
 * @returns the git api
 */
export async function getGitExtensionApi(): Promise<API> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) {
    const message =
      'The VSCode Git extension was requested but was not found. Please verify that the VSCode Git extension install and enabled.';
    logExtensionEvent(message);
    throw new ReferenceError(message);
  }
  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }
  return gitExtension.exports.getAPI(1);
}

/**
 * Gets the root repostiory
 *
 * @returns the repository object or undefined if this is not a git repository
 */
export async function getRootRepository(): Promise<Repository | undefined> {
  const gitExtension = await getGitExtensionApi();
  const [ws] = vscode.workspace.workspaceFolders ?? [];
  if (!ws) {
    return undefined;
  }
  const rootRepository = gitExtension?.repositories.find((repo) => repo.rootUri.path === ws.uri.path);
  return rootRepository;
}
