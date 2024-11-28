import * as vscode from 'vscode';
import { API, GitExtension, Repository } from '../git';
import { logExtensionEvent } from './logger';

/**
 * Gets an array of Heroku app names from the git remotes or
 * an empty array if no Heroku apps were found.
 *
 * @returns string[] An array of app names derived from the git remotes.
 */
export async function getHerokuAppNames(): Promise<string[]> {
  const rootRepository = await getRootRepository();
  const remotes = rootRepository?.state.remotes;

  if (!remotes) {
    return [];
  }
  const herokuRemotes = remotes.filter(
    (remote) => remote.name.includes('heroku') && !!remote.pushUrl?.includes('heroku')
  );

  const appNames = new Set<string>();
  for (const herokuRemote of herokuRemotes ?? []) {
    const { pushUrl } = herokuRemote;
    if (!URL.canParse(pushUrl!)) {
      continue;
    }
    const { pathname } = new URL(pushUrl!);
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
      'The VSCode Git extension was requested but was not found. Please verify that the VSCode Git extension is installed and enabled.';
    logExtensionEvent(message);
    throw new ReferenceError(message);
  }
  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }
  const api = gitExtension.exports.getAPI(1);
  if (api.state === 'uninitialized') {
    const d = await new Promise<vscode.Disposable>((resolve) => {
      const disposable = api.onDidChangeState((state) => {
        if (state === 'initialized') {
          resolve(disposable);
        }
      });
    });
    d.dispose();
  }
  return api;
}

/**
 * Gets the root repository
 *
 * @returns the repository object or undefined if this is not a git repository
 */
export async function getRootRepository(): Promise<Repository | undefined> {
  const gitExtension = await getGitExtensionApi();
  const [ws] = vscode.workspace.workspaceFolders ?? [];
  if (!ws) {
    return undefined;
  }
  return gitExtension?.repositories.find((repo) => repo.rootUri.path === ws.uri.path);
}

/**
 * Creates a github session and returns it.
 * This session grants read-only access to repositories
 * and represents a minimal set of permissions to search
 * for and read the contents of public repositories.
 *
 * @param createIfNone If true, a new session will be created if one does not exist
 * @returns The authentication session or undefined if the user disallows it or fails to authenticate
 */
export async function getGithubSession(
  createIfNone: boolean = true
): Promise<vscode.AuthenticationSession | undefined> {
  const session = await vscode.authentication.getSession(
    'github', // authentication provider ID
    ['repo', 'read:user'], // scopes needed for your extension
    { createIfNone } // creates auth session if none exists
  );

  return session;
}
