import type { ChildProcess } from 'node:child_process';

import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommand, HerokuCommandCompletionInfo } from '../heroku-command';

@herokuCommand({
  outputChannelId: HerokuOutputChannel.Authentication
})
/**
 * The login command delegates authentication to
 * the HerokuCLI using the browser auth flows.
 */
export class LoginCommand extends HerokuCommand<HerokuCommandCompletionInfo> {
  public static COMMAND_ID = 'heroku:auth:login' as const;

  /**
   * Event handler for the Heroku CLI stdout.
   * This handler looks for the promt: "Press any key to open a browser.."
   * and writes a keystroke to stdin to automate the opening
   * of the browser without the need for user input.
   *
   * @param chunk The string output from the child process.
   * @param cliAuthProcess The HerokuCli child process.
   */
  private static onData(chunk: string, cliAuthProcess: ChildProcess): void {
    // The Heroku CLI sends the message:
    // "Press any key to open up the browser to login or q to exit:"
    if (chunk.includes('Press any key')) {
      cliAuthProcess.stdin?.write('o');
    }
  }

  /**
   * Runs the `heroku auth:login` command using
   * the browser auth flow and returns the uninterpreted
   * result from the child process.
   *
   * Note that the Heroku CLI does not terminate
   * properly on a successful auth attempt for an
   * unknown reason. This run function must kill
   * the child process manually as a result.
   *
   * @returns The result of the Heroku CLI command
   */
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
