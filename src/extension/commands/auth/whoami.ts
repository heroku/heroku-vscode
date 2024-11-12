import AccountService from '@heroku-cli/schema/services/account-service.js';
import type { Account } from '@heroku-cli/schema';
import vscode from 'vscode';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import { TokenCommand } from './token';

export type WhoAmIResult = { account: Account; token: string };
@herokuCommand()
/**
 * The WhoAmI command delegates to the Heroku CLI
 * to determine the identity of the current user.
 */
export class WhoAmI<T extends WhoAmIResult = WhoAmIResult> extends HerokuCommand<T> {
  public static COMMAND_ID = 'heroku:auth:whoami' as const;
  protected accountService = new AccountService(fetch, 'https://api.heroku.com');

  /**
   * Runs the `heroku auth:whoami` command and returns
   * the identity of the user or null if no user is
   * signed in.
   *
   * @returns The identity of the current user or null if no user is signed in.
   */
  public async run(): Promise<T> {
    const token = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID); // throws if not logged in
    const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${token}` } };
    const account = await this.accountService.info(requestInit);
    return { token, account } as T;
  }
}
