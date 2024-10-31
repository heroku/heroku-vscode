import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * Any other commands. This acts as a catch-all for commands
 * that do to have a dedicated command runner.
 */
export class HerokuUnknownCommandRunner extends HerokuCommandRunner<unknown> {
  public static COMMAND_ID = 'heroku:unknown:runner';
  /**
   *
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    unknownData?: { app?: { id: string; name: string }; id?: string; name?: string }
  ): PromiseLike<void> | void {
    if (args.app?.required && unknownData) {
      userInputByArg.set('app', unknownData.name ?? unknownData.app?.name);
    }
  }

  /**
   *
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    unknownData?: { app?: { id: string; name: string }; id?: string; name?: string }
  ): PromiseLike<void> | void {
    if (flags.app?.required && unknownData) {
      userInputByFlag.set('app', unknownData.name ?? unknownData.app?.name);
    }
  }
}
