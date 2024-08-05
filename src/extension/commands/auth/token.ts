import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

@herokuCommand()
/**
 * The Token command delegates to the Heroku CLI for
 * the retrieval of the bearer token. This token is
 * used by the extension when making internal API
 * requests.
 */
export class TokenCommand extends HerokuCommand<string | null> {
  public static COMMAND_ID = 'heroku:auth:token' as const;

  /**
   * Runs the `heroku auth:token` command and returns the
   * token if the user is signed in or null otherwise.
   *
   * @returns The bearer token or null if the user is not signed in.
   */
  public async run(): Promise<string | null> {
    using cliTokenProcess = HerokuCommand.exec('heroku auth:token', { signal: this.signal });
    const { exitCode, output, errorMessage } = await HerokuCommand.waitForCompletion(cliTokenProcess);

    return exitCode === 0 && !errorMessage ? output : null;
  }
}
