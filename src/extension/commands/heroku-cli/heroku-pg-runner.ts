import type { AddOn } from '@heroku-cli/schema';
import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The HerokuPgRunner is used to run commands
 * related to Postgres either from the command pallette
 * or the context menu of the AddOn view.
 */
export class HerokuPgRunner extends HerokuCommandRunner<AddOn> {
  public static COMMAND_ID = 'heroku:pg:runner';
  /**
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    herokuPg?: AddOn | undefined
  ): PromiseLike<void> | void {
    if (flags.app?.required && herokuPg) {
      userInputByFlag.set('app', herokuPg?.app.name);
    }
  }

  /**
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    herokuPg?: AddOn | undefined
  ): PromiseLike<void> | void {
    if (args.app?.required && herokuPg) {
      userInputByArg.set('app', herokuPg?.app.name);
    }
  }
}
