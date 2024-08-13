import * as vscode from 'vscode';
import { GitExtension } from '../git';

/**
 * Gets an array of Heroku app names from the git remotes or
 * an empty array if no Heroku apps were found.
 *
 * @returns string[] An array of app names derived from the git remotes.
 */
export async function getHerokuAppNames(): Promise<string[]> {
  // https://github.com/microsoft/vscode/blob/main/extensions/git/package.json
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  const api = gitExtension?.exports.getAPI(1);
  let state: string | undefined;
  while (state !== 'initialized') {
    state = await new Promise((resolve) => api?.onDidChangeState(resolve));
  }
  const [repos] = api?.repositories ?? [];
  const herokuRemotes = repos?.state.remotes.filter(
    (remote) =>
      remote.name.includes('heroku') && (!!remote.pushUrl?.includes('heroku') || !!remote.fetchUrl?.includes('heroku'))
  );

  const appNames: string[] = [];
  for (const herokuRemote of herokuRemotes) {
    const url = herokuRemote?.pushUrl ?? herokuRemote?.fetchUrl ?? '';
    if (!URL.canParse(url)) {
      continue;
    }
    const { pathname } = new URL(url);
    appNames.push(pathname.replaceAll(/(\/|.git)/g, ''));
  }
  return appNames;
}
