import * as vscode from 'vscode';
/**
 * Create an AuthenticationSession object with
 * the specified details.
 *
 * @param whoami The identify of the current user
 * @param accessToken The auth token for the current user.
 * @param scopes Scopes, if any that are relevant to the session.
 * @param userId The user id of the current user.
 * @returns AuthenticationSession
 */
export function createSessionObject(
  whoami: string,
  accessToken: string,
  scopes: readonly string[],
  userId: string
): vscode.AuthenticationSession {
  return {
    account: {
      id: 'Heroku',
      label: whoami
    },
    id: userId,
    scopes,
    accessToken
  };
}
