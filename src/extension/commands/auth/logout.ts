import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import type { HerokuCommandCompletionInfo } from '../heroku-command';

@herokuCommand()
/**
 * The Logout command delegates to the Heroku CLI
 * when the user asks to be signed out of Heroku
 */
export class LogoutCommand extends HerokuCommand<HerokuCommandCompletionInfo> {
  public static COMMAND_ID = 'heroku:auth:logout' as const;

  /**
   * Runs the `heroku auth:logout` command in a child
   * process and returns the result.
   *
   * @returns The uninterpreted reult from the Heroku CLI child process.
   */
  public async run(): Promise<HerokuCommandCompletionInfo> {
    using logoutProcess = HerokuCommand.exec('heroku auth:logout', { signal: this.signal });
    const result = await HerokuCommand.waitForCompletion(logoutProcess);
    return result;
  }
}
