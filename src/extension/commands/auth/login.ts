import type { ChildProcess } from 'node:child_process';

import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommand, HerokuCommandCompletionInfo } from '../heroku-command';

@herokuCommand({
  outputChannelId: HerokuOutputChannel.Authentication
})
export class LoginCommand extends HerokuCommand<HerokuCommandCompletionInfo> {
  public static COMMAND_ID = 'heroku:auth:login' as const;

  private static onData(chunk: string, cliAuthProcess: ChildProcess): void {
    // The Heroku CLI sends the message:
    // "Press any key to open up the browser to login or q to exit:"
    if (chunk.includes('Press any key')) {
      cliAuthProcess.stdin?.write('o');
    }
  }

  public async run(): Promise<HerokuCommandCompletionInfo> {
    using cliAuthProcess = HerokuCommand.exec('heroku auth:login', {signal: this.signal, timeout: 120 * 1000});

    cliAuthProcess.stderr?.once('data', (data: string) => LoginCommand.onData(data, cliAuthProcess));

    let success = false;
    cliAuthProcess.stdout?.addListener('data', (chunk: string) => {
      if (chunk.includes('Logged in as')) {
        success = true;
        cliAuthProcess.kill();
      }
    });

    const result = await HerokuCommand.waitForCompletion(cliAuthProcess);
    if (success) {
      result.exitCode = 0;
    }
    return result;
  }
}
