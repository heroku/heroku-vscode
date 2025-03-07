import { herokuCommand } from '../../meta/command';
import { findPasswordLineNumber, getNetRcContents } from '../../utils/netrc-locator';
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
    const netrcContents = await getNetRcContents();
    if (netrcContents === null) {
      return null;
    }

    // Split into lines and normalize whitespace
    const lines = netrcContents.split('\n');
    const pwLine = findPasswordLineNumber(lines);
    if (pwLine === -1) {
      return null;
    }
    return lines[pwLine].replace('password', '').trim();
  }
}
