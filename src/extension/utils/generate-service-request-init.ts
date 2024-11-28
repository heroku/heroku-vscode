import vscode, { type AuthenticationSession } from 'vscode';
/**
 * Generates a request init object for making API requests to the Heroku API.
 *
 * @param signal An optional abort signal to pass to the request init object.
 * @returns A promise that resolves to a request init object.
 */
export async function generateRequestInit(signal?: AbortSignal): Promise<RequestInit> {
  const { accessToken } = (await vscode.authentication.getSession('heroku:auth:login', [])) as AuthenticationSession;
  return { signal, headers: { Authorization: `Bearer ${accessToken.trim()}` } };
}
