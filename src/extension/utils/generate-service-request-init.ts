import vscode, { type AuthenticationSession } from 'vscode';

const extension = vscode.extensions.getExtension('Heroku-Dev-Tools.heroku') ?? { packageJSON: {} };
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
  let id = '';
  if (!accessToken) {
    ({ accessToken = '', id = '' } = ((await vscode.authentication.getSession('heroku:auth:login', [])) ??
      {}) as AuthenticationSession);
  }
  const headers = {
    Referer: `vscode-heroku-extension/${version}`,
    'User-Agent': `VSCode-Heroku-Extension/${version} (${process.platform}; ${process.arch}) VSCode/${vscode.version}`
  };

  if (accessToken) {
    Reflect.set(headers, 'Authorization', `Bearer ${accessToken.trim()}`);
  }

  if (id) {
    Reflect.set(headers, 'X-Account-Id', id);
  }

  return {
    signal,
    headers
  };
}
