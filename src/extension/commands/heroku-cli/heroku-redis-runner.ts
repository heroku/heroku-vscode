import { AddOn } from '@heroku-cli/schema';
import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The HerokuRedisRunner is used to run commands
 * related to Redis either from the command pallette
 * or the context menu of the AddOn view.
 */
export class HerokuRedisRunner extends HerokuCommandRunner<AddOn> {
  public static COMMAND_ID = 'heroku:redis:runner';

  /**
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    herokuRedis?: AddOn | undefined
  ): PromiseLike<void> | void {
    if (flags.app?.required && herokuRedis) {
      userInputByFlag.set('app', herokuRedis?.app.name);
    }
  }

  /**
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    herokuRedis?: AddOn | undefined
  ): PromiseLike<void> | void {
    if (args.app?.required && herokuRedis) {
      userInputByArg.set('app', herokuRedis?.app.name);
    }
  }
}
