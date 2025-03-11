import AccountService from '@heroku-cli/schema/services/account-service.js';
import type { Account } from '@heroku-cli/schema';
import vscode from 'vscode';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import { generateRequestInit } from '../../utils/generate-service-request-init';
import { TokenCommand } from './token';

export type WhoAmIResult = { account: Account; token: string };
@herokuCommand()
/**
 * The WhoAmI command delegates to the Heroku CLI
 * to determine the identity of the current user.
 */
export class WhoAmI<T extends WhoAmIResult = WhoAmIResult> extends HerokuCommand<T> {
  public static COMMAND_ID = 'heroku:auth:whoami' as const;
  public static account: Account | undefined;

  protected accountService = new AccountService(fetch, 'https://api.heroku.com');

  /**
   * Runs the `heroku auth:whoami` command and returns
   * the identity of the user or null if no user is
   * signed in.
   *
   * @param omitToken Omits the bearer token from the results.
   * @param tokenOverride Overrides the bearer token to use for the request.
   * @returns The identity of the current user or null if no user is signed in.
   */
  public async run(omitToken = false, tokenOverride = undefined): Promise<T> {
    const token = omitToken
      ? undefined
      : (tokenOverride ?? (await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID)));
    if (!token) {
      return { token: '', account: WhoAmI.account ?? {} } as T;
    }

    const requestInit = await generateRequestInit(this.signal, token);
    const account = (WhoAmI.account ??= await this.accountService.info(requestInit));
    return { token, account } as T;
  }
}
