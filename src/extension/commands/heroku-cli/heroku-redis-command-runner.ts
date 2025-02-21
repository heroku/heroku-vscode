import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuContextMenuCommandRunner } from './heroku-context-menu-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 *
 */
export class HerokuRedisCommandRunner extends HerokuContextMenuCommandRunner {
  public static COMMAND_ID = 'heroku:redis:command:runner';

  /**
   * @inheritdoc
   */
  public async executeCommand(command: string): Promise<void> {
    return super.executeCommand(command, this.commandName === 'redis:cli' || this.commandName === 'pg:psql');
  }
}
