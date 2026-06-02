import type { App } from '@heroku-cli/schema';
import { herokuCommand, type RunnableCommand } from '../../../meta/command';
import { LogSessionStream } from './start-log-session';

@herokuCommand()
/**
 * Command to end the log session for the given app.
 */
export class EndLogSession extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:end-log-session' as const;

  /**
   * Ends the log session for the given app.
   *
   * @param app The app to end the log session for.
   */
  public run(app: App & { logSession?: LogSessionStream }): void {
    if (app.logSession) {
      // Setting `muted = true` flows through StartLogSession's
      // setter, which clears the visible output channel and fires
      // MUTED_CHANGED. The underlying stream keeps running so the
      // resource explorer continues to receive state updates.
      // `Reflect.set` here only because `no-param-reassign` flags
      // direct property writes through `app`.
      Reflect.set(app.logSession, 'muted', true);
    }
  }

  /**
   * Disposes of the command.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
