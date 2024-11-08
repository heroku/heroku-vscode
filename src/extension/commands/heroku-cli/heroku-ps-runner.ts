import type { Dyno } from '@heroku-cli/schema';
import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuContextMenuCommandRunner } from './heroku-context-menu-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The HerokuPsRunner is used to run commands
 * related to Dynos either from the command pallette
 * or the context menu of the Dynos view.
 */
export class HerokuPsRunner extends HerokuContextMenuCommandRunner {
  public static COMMAND_ID = 'heroku:ps:runner' as const;

  /**
   * @inheritdoc
   */
  protected async hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    dyno?: Dyno
  ): Promise<void> {
    await super.hydrateArgs(userInputByArg, args, dyno);

    if (args.dyno?.required && dyno) {
      userInputByArg.set('dyno', dyno.name);
    }
  }

  /**
   * @inheritdoc
   */
  protected async hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    dyno?: Dyno
  ): Promise<void> {
    await super.hydrateFlags(userInputByFlag, flags, dyno);

    if (flags.dyno?.required && dyno) {
      userInputByFlag.set('dyno', dyno.name);
    }
  }
}
