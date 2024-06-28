import { exec } from 'node:child_process';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

@herokuCommand
export class WhoAmI extends HerokuCommand<string | null> {
  public static COMMAND_ID = 'heroku:auth:whoami';

  public async run(): Promise<string | null> {
    using cliWhoAmIProcess = exec('heroku auth:whoami', { signal: this.signal });
    const { exitCode, output } = await HerokuCommand.waitForCompletion(cliWhoAmIProcess);

    return exitCode === 0 ? output.trim() : null;
  }
}
