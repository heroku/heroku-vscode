import vscode from 'vscode';
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
    if (!file) {
      return null;
    }
    let netrcContents: string;
    if (file.endsWith('.gpg')) {
      const gpgProcess = HerokuCommand.exec(`gpg --batch --quiet --decrypt ${file}`);
      const { exitCode, output } = await HerokuCommand.waitForCompletion(gpgProcess);
      if (exitCode !== 0) {
        return null;
      }
      netrcContents = output;
    } else {
      const netRcBuffer = await vscode.workspace.fs.readFile(vscode.Uri.parse(file));
      netrcContents = netRcBuffer.toString();
    }

    // Split into lines and normalize whitespace
    const lines = netrcContents.split('\n').map((line) => line.trim());

    // Find the index of the Heroku API machine entry
    const machineIndex = lines.findIndex((line) => line === 'machine api.heroku.com');

    if (machineIndex === -1) {
      return null;
    }

    // Look for password in subsequent lines until we hit another machine or end
    for (let i = machineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('machine')) {
        break;
      }
      if (line.startsWith('password')) {
        return line.replace('password', '').trim();
      }
    }

    return null;
  }
}
