import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

@herokuCommand()
/**
 * The WhoAmI command delegates to the Heroku CLI
 * to determine the identity of the current user.
 */
export class WhoAmI extends HerokuCommand<string | null> {
  public static COMMAND_ID = 'heroku:auth:whoami' as const;

  /**
   * Runs the `heroku auth:whoami` command and returns
   * the identity of the user or null if no user is
   * signed in.
   *
   * @returns The identity of the current user or null if no user is signed in.
   */
  public async run(): Promise<string | null> {
    using cliWhoAmIProcess = HerokuCommand.exec('heroku auth:whoami', { signal: this.signal });
    const { exitCode, output } = await HerokuCommand.waitForCompletion(cliWhoAmIProcess);

    return exitCode === 0 ? output.trim() : null;
  }
}
