import type { App } from '@heroku-cli/schema';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { CommandMeta } from '../../manifest';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The HerokuAppsRunner is used to execute the
 * Heroku CLI for the apps topic.
 */
export class HerokuAppsRunner extends HerokuCommandRunner<App> {
  public static COMMAND_ID = 'heroku:apps:runner';

  /**
   *
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    app?: App
  ): PromiseLike<void> | void {
    if (args.app?.required && app) {
      userInputByArg.set('app', app.name);
    }
  }

  /**
   *
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    app?: App
  ): PromiseLike<void> | void {
    if (flags.app?.required && app) {
      userInputByFlag.set('app', app.name);
    }
  }
}
