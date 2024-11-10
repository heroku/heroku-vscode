import { herokuCommand } from '../../meta/command';
import { getNetrcFileLocation } from '../../utils/netrc-locator';
import { HerokuCommand } from '../heroku-command';

@herokuCommand()
/**
 * Retrieves the bearer token from the .netrc file.
 * This token is used by the extension when making
 * internal API requests.
 */
export class TokenCommand extends HerokuCommand<string | null> {
  public static COMMAND_ID = 'heroku:auth:token' as const;

  /**
   * Retrieves the bearer token from the .netrc file.
   * This token is used by the extension when making
   * internal API requests.
   *
   * @returns The bearer token from the .netrc file.
   */
  public async run(): Promise<string | null> {
    const file = await getNetrcFileLocation();
    const gpgProcess = HerokuCommand.exec(`gpg --batch --quiet --decrypt ${file}`);
    const { exitCode, output } = await HerokuCommand.waitForCompletion(gpgProcess);
    if (exitCode !== 0) {
      return null;
    }

    const machines = output.split(/(?:\n(?! ))/);
    const machine = machines.find((m) => m.startsWith('machine api.heroku.com'));
    if (!machine) {
      return null;
    }
    const password = machine.split(/(?:\n)/).find((f) => f.trim().startsWith('password'));
    if (!password) {
      return null;
    }

    return password.replace('password', '').trim();
  }
}
