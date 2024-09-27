import { type ReadableStreamDefaultReader } from 'node:stream/web';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import * as vscode from 'vscode';
import type { App, LogSession } from '@heroku-cli/schema';
import { herokuCommand, HerokuOutputChannel, type RunnableCommand } from '../../../meta/command';
import { Bindable, PropertyChangedEvent } from '../../../meta/property-change-notfier';

export type LogSessionStream = {
  /**
   * Attaches a callback to the stream. Each
   * chunk from the stream will trigger the callback
   * and the string value will be passed as the sole
   * argument
   *
   * @param cb The callback to execute when a chunk from the stream is received.
   */
  attach: (cb: LogStreamCallback) => void;
  /**
   * Detaches a callback from the stream.
   *
   * @param cb The callback to detach.
   */
  detach: (cb: LogStreamCallback) => void;
  /**
   * Boolean indicating whether this log session is muted.
   * If muted, no logs will be written to the output channel
   * but the stream will still be active. If the log session
   * is aborted, it will also be considered muted and the log
   * stream will be destroyed.
   */
  muted: boolean;
};
export type LogStreamCallback = (chunk: string, app: App) => void;

@herokuCommand({ outputChannelId: HerokuOutputChannel.LogOutput, languageId: 'heroku-logs' })
/**
 * Command used to start a log session for
 * the supplied App object and pipe the output
 * to the output channel when <code>muted</code>
 * is false.
 *
 * Log sessions are appended to the App object using
 * the <code>logSession</code> property. This allows
 * implementors to manage the log session without having
 * to retain a direct reference to it as is the case
 * when this command is executed from a context menu.
 */
export class StartLogSession extends AbortController implements LogSessionStream, RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:start-log-session';
  private static visibleLogSession: StartLogSession | undefined;

  private logService = new LogSessionService(fetch, 'https://api.heroku.com');
  private app!: Bindable<App & { logSession?: StartLogSession }>;
  private buffer: string[] = [];
  private streamListeners: Set<CallableFunction> = new Set();
  private maxLines = 100;

  // Backing property for the get/set pair
  #muted = false;

  /**
   * @inheritdoc
   */
  public constructor(private readonly outputChannel?: vscode.OutputChannel) {
    super();
  }

  /**
   * Boolean indicating whether this log session is muted.
   * If muted, no logs will be written to the output channel
   * but the stream will still be active. If the log session
   * is aborted, it will also be considered muted and the log
   * stream will be destroyed.
   *
   * @returns true if muted, false otherwise
   */
  public get muted(): boolean {
    return this.#muted || this.signal.aborted;
  }

  /**
   * @inheritdoc
   */
  public set muted(value: boolean) {
    if (this.#muted === value) {
      return;
    }
    this.#muted = value;
    StartLogSession.updateExistingLogSession(this, this.#muted);
  }

  /**
   * Updates an existing log session.
   *
   * @param existingLogSession The log session to update.
   * @param muted Whether to mute the log session or not.
   * @param lines The number of lines to show in the output channel.
   */
  private static updateExistingLogSession(existingLogSession: StartLogSession, muted: boolean, lines?: number): void {
    const { visibleLogSession } = StartLogSession;

    // We're unplugging the existing visible log session
    // and preparing the output channel for the new log stream
    if (visibleLogSession && visibleLogSession !== existingLogSession && !muted) {
      visibleLogSession.muted = true;
      visibleLogSession.outputChannel?.clear();
    }

    if (visibleLogSession === existingLogSession) {
      return;
    }

    const { outputChannel, buffer, app, muted: oldMuted } = existingLogSession;
    if (!muted) {
      this.prepareOutputChannelForLogSession(outputChannel, app.name);
      outputChannel?.append(buffer.slice(0, lines).join('\n'));
      StartLogSession.visibleLogSession = existingLogSession;
    }

    if (muted !== oldMuted) {
      Reflect.set(existingLogSession, 'muted', muted);
    }
    Reflect.set(existingLogSession, 'maxLines', lines);
  }

  /**
   * Prepares the output channel for logging.
   * Clears the output channel and appends the app name to it.
   *
   * @param outputChannel The output channel to prepare.
   * @param appName The name of the app to display in the output channel.
   */
  private static prepareOutputChannelForLogSession(
    outputChannel: vscode.OutputChannel | undefined,
    appName: string
  ): void {
    outputChannel?.clear();
    outputChannel?.appendLine(`Log session started for ${appName}`);
    outputChannel?.show(true);
  }

  /**
   * Attaches a callback to the stream. Each
   * chunk from the stream will trigger the callback
   * and the string value will be passed as the sole
   * argument
   *
   * @param cb The callback to execute when a chunk from the stream is received.
   */
  public attach(cb: LogStreamCallback): void {
    this.streamListeners.add(cb);
  }

  /**
   * Detaches a callback from the stream.
   *
   * @param cb The callback to detach.
   */
  public detach(cb: LogStreamCallback): void {
    this.streamListeners.delete(cb);
  }

  /**
   * Runs the command based on the specified input.
   * If a log stream is already running for the specified app,
   * it will be updated with the new settings.
   * Otherwise, a new log stream will be created and started.
   *
   * @param app The App object to run the command against.
   * @param muted Boolean indicating whether the log stream should be piped to the output channel.
   * @param lines The number of lines from the log history to show in the output channel.
   * @returns Promise<void
   */
  public async run(app: Bindable<App & { logSession?: StartLogSession }>, muted = false, lines = 100): Promise<void> {
    // Log session already exists, just mute/unmute it
    const { logSession: existingLogSession } = app;
    if (existingLogSession && !existingLogSession.signal.aborted) {
      const shouldBeMuted = !existingLogSession.muted ? false : muted; // a value of false becomes 'sticky'
      return StartLogSession.updateExistingLogSession(existingLogSession, shouldBeMuted, lines);
    }

    const logSession = await this.fetchLogSession(app, lines);
    const response = await fetch(logSession.logplex_url, { signal: this.signal });
    if (response.ok) {
      const reader = response.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>;
      if (!muted) {
        StartLogSession.prepareOutputChannelForLogSession(this.outputChannel, app.name);
      }
      // Since the stream is a log runnning process
      // we want this function to complete without
      // having to wait for the stream to end.
      void this.beginReading(reader);
    } else {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    this.maxLines = lines;
    this.#muted = muted;
    this.app = app;
    this.app.logSession = this;
    this.app.on(PropertyChangedEvent.PROPERTY_CHANGED, this.onAppPropertyChanged);
  }

  /**
   * @inheritdoc
   */
  public [Symbol.dispose](): void {
    // no-op - do not dispose using this.
  }

  /**
   * Fetches a log session from the API.
   *
   * @param app The app to fetch a log session for.
   * @param lines The number of lines from the log history to display initially.
   * @returns The log session.
   */
  private async fetchLogSession(app: App, lines: number): Promise<LogSession> {
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
    return logSession;
  }

  /**
   * Begins reading from the log stream and appends the output to the output channel.
   *
   * @param reader The readable stream to begin reading from
   * @returns Promise<void>
   */
  private async beginReading(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    while (!this.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        this.app.logSession = undefined;
        break;
      }
      if (value.length > 1) {
        const str = Buffer.from(value).toString();
        this.streamListeners.forEach((cb) => void cb(str, this.app));
        this.buffer.push(str);

        if (this.buffer.length > this.maxLines) {
          this.buffer.shift();
        }

        if (!this.muted) {
          this.outputChannel?.append(str);
        }
      }
    }
  }

  /**
   * Event handler for app property changes. Aborts the log session if
   * the app's logSession propery is deleted or undefined.
   *
   * @param event The PropertyChangedEvent passed to the handler
   */
  private onAppPropertyChanged = (event: PropertyChangedEvent<App & { logSession?: StartLogSession }>): void => {
    // Any changes to the 'logSession' property
    // should result in aborting the currently
    // running log session since this indicates
    // either the stream has ended or another
    // actor has aborted it or started a new one
    // for this app.
    if (event.property === 'logSession') {
      this.abort();
      this.outputChannel?.append('Log session ended.');
      this.app.off(PropertyChangedEvent.PROPERTY_CHANGED, this.onAppPropertyChanged);
    }
  };
}
