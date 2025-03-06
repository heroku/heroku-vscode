import vscode, { type AuthenticationSession } from 'vscode';

const extension = vscode.extensions.getExtension('heroku.heroku') ?? { packageJSON: {} };
const version = (Reflect.get(extension.packageJSON, 'version') as string) ?? '';

/**
 * Generates a request init object for making API requests to the Heroku API.
 *
 * @param signal An optional abort signal to pass to the request init object.
 * @param token An optional bearer token to pass to the request init object.
 * @returns A promise that resolves to a request init object.
 */
export async function generateRequestInit(signal?: AbortSignal, token?: string): Promise<RequestInit> {
  let accessToken = token;
  if (!accessToken) {
    ({ accessToken } = (await vscode.authentication.getSession('heroku:auth:login', [])) as AuthenticationSession);
  }
  return {
    signal,
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      Referer: `vscode-heroku-extension/${version}`,
      'User-Agent': `VSCode-Heroku-Extension/${version} (${process.platform}; ${process.arch}) VSCode/${vscode.version}`
    }
  };
}
