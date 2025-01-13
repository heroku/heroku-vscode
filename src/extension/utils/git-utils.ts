import * as vscode from 'vscode';
import { API, GitExtension, Repository } from 'git-extension';
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
 * Gets the remote name for a given app name
 *
 * @param appName the name of the app to get the remote for
 * @returns the remote url or undefined if the app is not found
 */
export async function getRemoteNameByAppName(appName: string): Promise<string | undefined> {
  const rootRepository = await getRootRepository();
  const remotes = rootRepository?.state.remotes;

  if (!remotes) {
    return undefined;
  }
  const herokuRemote = remotes.find((remote) => {
    const { pushUrl } = remote;
    if (!URL.canParse(pushUrl!)) {
      return false;
    }
    const { pathname } = new URL(pushUrl!);
    return pathname.replaceAll(/(\/|.git)/g, '') === appName ? pathname : undefined;
  });

  return herokuRemote?.name;
}

/**
 * Removes the remote for the given app name
 * and returns true if the remote was removed, false otherwise.
 *
 * @param appName the name of the app to remove the remote for
 * @returns true if the remote was removed, false otherwise
 */
export async function removeRemoteByAppName(appName: string): Promise<string | undefined> {
  const herokuRemote = await getRemoteNameByAppName(appName);
  const rootRepository = await getRootRepository();

  if (herokuRemote) {
    try {
      await rootRepository?.removeRemote(herokuRemote);
    } catch (error) {
      const { message } = error as Error;
      logExtensionEvent(`Error removing remote: ${message}`);
    }
    return herokuRemote;
  }
  return undefined;
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
  const session = await vscode.authentication.getSession('github', ['repo', 'read:user'], { createIfNone });

  return session;
}

/**
 * Gets the owner and repository name from the git repository
 * based on the provided URI.
 *
 * @param uri The URI of the git repository
 *
 * @returns An object containing the owner and repo name, or undefined if not found
 */
export async function getGitRepositoryInfoByUri(uri: vscode.Uri): Promise<{ owner: string; repo: string } | undefined> {
  try {
    const api = await getGitExtensionApi();

    // Get remote URLs from the repository state
    const remotes = api.getRepository(uri)?.state.remotes;
    if (!remotes?.length) {
      return undefined;
    }

    // Try to find origin first, fall back to any remote if origin doesn't exist
    const remote = remotes.find((r) => r.name === 'origin') ?? remotes[0];
    const remoteUrl = remote.fetchUrl ?? remote.pushUrl;

    if (!remoteUrl) {
      return undefined;
    }

    // Handle different Git URL formats
    let match: RegExpMatchArray | null;

    // Handle SSH URL format (git@github.com:owner/repo.git)
    if (remoteUrl.startsWith('git@')) {
      match = remoteUrl.match(/git@github\.com:([^/]+)\/([^.]+)(?:\.git)?/);
    }
    // Handle HTTPS URL format (https://github.com/owner/repo.git)
    else {
      try {
        const url = new URL(remoteUrl);
        match = url.pathname.match(/\/([^/]+)\/([^.]+)(?:\.git)?/);
      } catch {
        return undefined;
      }
    }

    if (!match || match.length < 3) {
      return undefined;
    }

    return {
      owner: match[1],
      repo: match[2]
    };
  } catch (error) {
    logExtensionEvent(`Error getting repository info: ${(error as Error).message}`);
    return undefined;
  }
}
