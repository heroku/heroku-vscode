import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import type { HerokuCommandCompletionInfo } from '../heroku-command';

@herokuCommand({
  outputChannelId: HerokuOutputChannel.Authentication
})
export class LogoutCommand extends HerokuCommand<HerokuCommandCompletionInfo> {
  public static COMMAND_ID = 'heroku:auth:logout';

  public async run(): Promise<HerokuCommandCompletionInfo> {
    using logoutProcess = HerokuCommand.exec('heroku auth:logout', { signal: this.signal });
    const result = await HerokuCommand.waitForCompletion(logoutProcess);
    this.outputChannel?.appendLine(`${result.output}`);
    return result;
  }
}
