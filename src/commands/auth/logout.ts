import { exec } from 'node:child_process';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

@herokuCommand
export class LogoutCommand extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:auth:logout';

  public async run(): Promise<void> {
    using logoutProcess = exec('heroku auth:logout', { signal: this.signal });
    logoutProcess.stderr?.addListener('data', this.forwardToOutputChannel);
    await HerokuCommand.waitForCompletion(logoutProcess);
  }

  private forwardToOutputChannel = (data: string): void => {
    this.outputChannel?.appendLine(data);
  };
}
