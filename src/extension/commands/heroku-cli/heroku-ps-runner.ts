import type { Dyno } from '@heroku-cli/schema';
import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The HerokuPsRunner is used to run commands
 * related to Dynos either from the command pallette
 * or the context menu of the Dynos view.
 */
export class HerokuPsRunner extends HerokuCommandRunner<Dyno> {
  public static COMMAND_ID = 'heroku:ps:runner';

  /**
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    dyno?: Dyno
  ): PromiseLike<void> | void {
    if (args.app?.required && dyno) {
      userInputByArg.set('app', dyno?.app.name);
    }

    if (args.dyno?.required && dyno) {
      userInputByArg.set('dyno', dyno?.name);
    }
  }

  /**
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    dyno?: Dyno
  ): PromiseLike<void> | void {
    if (flags.app?.required && dyno) {
      userInputByFlag.set('app', dyno?.app.name);
    }

    if (flags.dyno?.required && dyno) {
      userInputByFlag.set('dyno', dyno?.name);
    }
  }
}
