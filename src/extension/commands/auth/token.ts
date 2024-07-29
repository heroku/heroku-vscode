import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

@herokuCommand()
export class TokenCommand extends HerokuCommand<string | null> {
  public static COMMAND_ID = 'heroku:auth:token' as const;

  public async run(): Promise<string | null> {
    using cliTokenProcess = HerokuCommand.exec('heroku auth:token', { signal: this.signal });
    const { exitCode, output, errorMessage } = await HerokuCommand.waitForCompletion(cliTokenProcess);

    return exitCode === 0 && !errorMessage ? output : null;
  }
}
