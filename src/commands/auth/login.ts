import { ChildProcess, exec } from 'node:child_process';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand, HerokuCommandCompletionInfo } from '../heroku-command';

@herokuCommand
export class LoginCommand extends HerokuCommand<HerokuCommandCompletionInfo> {
  public static COMMAND_ID = 'heroku:auth:login' as const;

  public async run(): Promise<HerokuCommandCompletionInfo> {
    using cliAuthProcess = exec('heroku auth:login', {signal: this.signal, timeout: 30 * 1000});

    cliAuthProcess.stderr?.once('data', (data: string) => this.onData(data, cliAuthProcess));

    cliAuthProcess.stdout?.addListener('data', (chunk: string) => {
      if (chunk.includes('Logged in as')) {
        cliAuthProcess.kill()
      }
    });

    return await HerokuCommand.waitForCompletion(cliAuthProcess);
  }

  private onData(chunk: string, cliAuthProcess: ChildProcess): void {
    // The Heroku CLI sends the message:
    // "Press any key to open up the browser to login or q to exit:"
    if (chunk.includes('Press any key')) {
      cliAuthProcess.stdin?.write('o');
      cliAuthProcess.stdout?.addListener('data', this.forwardToOutputChannel);
    }
  }

  private forwardToOutputChannel = (data: string): void => {
    this.outputChannel?.appendLine(data);
  };
}
