import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * Any other commands.
 */
export class HerokuUnknownCommandRunner extends HerokuCommandRunner<unknown> {
  public static COMMAND_ID = 'heroku:unknown:runner';
  /**
   * @inheritdoc
   */
  protected hydrateFlags(): PromiseLike<void> | void {
    // noop
  }
  /**
   * @inheritdoc
   */
  protected hydrateArgs(): PromiseLike<void> | void {
    // noop
  }
}
