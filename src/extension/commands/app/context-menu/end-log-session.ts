import type { App, LogSession } from '@heroku-cli/schema';
import { herokuCommand, type RunnableCommand } from '../../../meta/command';

@herokuCommand()
/**
 * Command to end the log session for the given app.
 */
export class EndLogSession extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:end-log-session';

  /**
   * Ends the log session for the given app.
   *
   * @param app The app to end the log session for.
   */
  public run(app: App & { logSession?: LogSession }): void {
    Reflect.deleteProperty(app, 'logSession');
  }

  /**
   * Disposes of the command.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
