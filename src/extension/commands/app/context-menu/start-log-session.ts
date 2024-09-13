import { type ReadableStreamDefaultReader } from 'node:stream/web';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import * as vscode from 'vscode';
import type { App, LogSession } from '@heroku-cli/schema';
import { herokuCommand, HerokuOutputChannel, type RunnableCommand } from '../../../meta/command';
import { Bindable, PropertyChangedEvent } from '../../../meta/property-change-notfier';

@herokuCommand({ outputChannelId: HerokuOutputChannel.LogOutput, languageId: 'heroku-logs' })
/**
 * Command to view the logs of an app.
 */
export class StartLogSession extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:start-log-session';
  private logService = new LogSessionService(fetch, 'https://api.heroku.com');
  private app!: Bindable<App & { logSession?: LogSession }>;

  /**
   * @inheritdoc
   */
  public constructor(private readonly outputChannel?: vscode.OutputChannel) {
    super();
  }

  /**
   * @inheritdoc
   */
  public async run(app: Bindable<App & { logSession?: LogSession }>, lines = 100): Promise<void> {
    this.app = app;
    let logSession: LogSession | undefined;
    try {
      const { accessToken } = (await vscode.authentication.getSession(
        'heroku:auth:login',
        []
      )) as vscode.AuthenticationSession;
      const requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };
      logSession = await this.logService.create(app.id, { tail: true, lines }, requestInit);
    } catch (e) {
      throw new Error(`Failed to create a log session: ${(e as Error).message}`);
    }

    const response = await fetch(logSession.logplex_url, { signal: this.signal });
    if (response.ok) {
      const reader = response.body!.getReader() as ReadableStreamDefaultReader<string>;

      void (async (): Promise<void> => {
        this.outputChannel?.clear();
        while (!this.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value.length > 1) {
            this.outputChannel?.append(Buffer.from(value).toString());
          }
        }
      })();
    } else {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    this.outputChannel?.show(true);
    app.on(PropertyChangedEvent.PROPERTY_CHANGED, this.onAppPropertyChanged);
    Reflect.set(app, 'logSession', logSession);
  }

  /**
   * @inheritdoc
   */
  public [Symbol.dispose](): void {
    // no-op
  }

  /**
   * Event handler for app property changes. Aborts the log session if
   * the app's logSession propery is deleted or undefined.
   *
   * @param event The PropertyChangedEvent passed to the handler
   */
  private onAppPropertyChanged = (event: PropertyChangedEvent<App & { logSession?: LogSession }>): void => {
    if (event.property === 'logSession' && !event.newValue) {
      this.abort();
      this.outputChannel?.append('Log session ended.');
      this.app.off(PropertyChangedEvent.PROPERTY_CHANGED, this.onAppPropertyChanged);
    }
  };
}
