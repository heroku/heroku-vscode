import AccountService from '@heroku-cli/schema/services/account-service.js';
import { Account } from '@heroku-cli/schema';
import vscode from 'vscode';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import { TokenCommand } from './token';

@herokuCommand()
/**
 * The WhoAmI command delegates to the Heroku CLI
 * to determine the identity of the current user.
 */
export class WhoAmI extends HerokuCommand<string | null> {
  public static COMMAND_ID = 'heroku:auth:whoami' as const;
  protected accountService = new AccountService(fetch, 'https://api.heroku.com');

  /**
   * Runs the `heroku auth:whoami` command and returns
   * the identity of the user or null if no user is
   * signed in.
   *
   * @returns The identity of the current user or null if no user is signed in.
   */
  public async run(): Promise<string | null> {
    let account: Account | undefined;
    try {
      const token = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
      const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${token}` } };
      account = await this.accountService.info(requestInit);
    } catch (e) {
      return null;
    }
    return account?.email;
  }
}
