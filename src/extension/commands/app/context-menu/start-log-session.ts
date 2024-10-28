import { type ReadableStreamDefaultReader } from 'node:stream/web';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import * as vscode from 'vscode';
import type { App, LogSession } from '@heroku-cli/schema';
import { herokuCommand, HerokuOutputChannel, type RunnableCommand } from '../../../meta/command';

/**
 * Represents a callback to be executed when a chunk
 * of data is received from the log stream.
 */
export type LogStreamCallback = (chunk: string, app: App) => void;

/**
 * Represents a log session stream.
 */
export type LogSessionStream = AbortController & {
  /**
   * The App object associated with this log session.
   */
  app: App | undefined;
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

  /**
   * Adds a callback that is executed when the log
   * stream is muted or unmuted. The callback will be
   * passed the new value of the muted property as its
   * sole argument.
   *
   * @param cb The callback to execute when the mute property is updated.
   * @returns void
   */
  onDidUpdateMute: (cb: (muted: boolean) => void) => void;
};

@herokuCommand({ outputChannelId: HerokuOutputChannel.LogOutput, languageId: 'heroku-logs' })
/**
 * Command used to start a log session for
 * the supplied App object and pipe the output
 * to the output channel when <code>muted</code>
 * is false. Only one log session is written to
 * the output channel at a time.
 *
 * Log sessions are appended to the App object using
 * the <code>logSession</code> property. This allows
 * implementors to manage the log session without having
 * to retain a direct reference to it as is the case
 * when this command is executed from a context menu.
 */
export class StartLogSession extends AbortController implements LogSessionStream, RunnableCommand<LogSessionStream> {
  public static COMMAND_ID = 'heroku:start-log-session';
  private static visibleLogSession: StartLogSession | undefined;

  private logService = new LogSessionService(fetch, 'https://api.heroku.com');
  private buffer = '';
  private streamListeners: Set<LogStreamCallback> = new Set();
  private muteListeners: Set<(muted: boolean) => void> = new Set();
  private maxLines = 100;
  private lastHeartbeatTime = 0;
  private timeoutId: NodeJS.Timeout | undefined;

  // Backing property for the readonly app getter
  #app: (App & { logSession?: StartLogSession }) | undefined;

  // Backing property for the get/set pair of the same name
  #muted = false;

  /**
   * @inheritdoc
   */
  public constructor(private readonly outputChannel?: vscode.OutputChannel) {
    super();
  }

  /**
   * Gets the app associated with this log session.
   *
   * @returns The app associated with this log session.
   */
  public get app(): (App & { logSession?: StartLogSession }) | undefined {
    return this.#app;
  }

  /**
   * Boolean indicating whether this log session is muted.
   * If muted, no logs will be written to the output channel
   * but the stream will still be active. If the log session
   * is aborted, it will also be considered muted and the log
   * stream will be destroyed.
   *
   * @returns true if muted, false otherwise.
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
    this.muteListeners.forEach((cb) => cb(this.#muted));
  }

  /**
   * Updates an existing log session.
   *
   * @param existingLogSession The log session to update.
   * @param muted Whether to mute the log session or not.
   */
  private static updateExistingLogSession(existingLogSession: StartLogSession, muted: boolean): void {
    const { visibleLogSession } = StartLogSession;

    // We're unplugging the existing visible log session
    // and preparing the output channel for the new log stream
    if (visibleLogSession && visibleLogSession !== existingLogSession && !muted) {
      visibleLogSession.muted = true;
      visibleLogSession.outputChannel?.clear();
    }

    const { outputChannel, buffer, app, muted: oldMuted } = existingLogSession;
    if (!muted) {
      this.prepareOutputChannelForLogSession(outputChannel, app!.name);
      // Take upto maxLines from the buffer and append to the output channel
      outputChannel?.append(buffer.split('\n').slice(0, visibleLogSession?.maxLines).join('\n'));
      StartLogSession.visibleLogSession = existingLogSession;
    }

    if (muted !== oldMuted) {
      Reflect.set(existingLogSession, 'muted', muted);
    }
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
   * Adds a callback that is executed when the log
   * stream is muted or unmuted. The callback will be
   * passed the new value of the muted property as its
   * sole argument.
   *
   * @param cb The callback to add when the mute property is updated.
   */
  public onDidUpdateMute(cb: (muted: boolean) => void): void {
    this.muteListeners.add(cb);
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
  public async run(app: App & { logSession?: StartLogSession }, muted = false, lines = 100): Promise<LogSessionStream> {
    this.maxLines = lines;
    this.#muted = muted;
    this.#app = app;
    // Log session already exists, just mute/unmute it
    const { logSession: existingLogSession } = app;
    if (existingLogSession && !existingLogSession.signal.aborted) {
      existingLogSession.maxLines = lines;
      existingLogSession.muted = !existingLogSession.muted ? false : muted; // a value of false becomes 'sticky';
      return existingLogSession;
    }
    try {
      await this.startLogSession();
    } catch {
      this.scheduleTimeout();
    }

    Reflect.set(app, 'logSession', this);
    return this;
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
  private async fetchLogSession(app: App, lines = this.maxLines): Promise<LogSession> {
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
    try {
      while (!this.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          this.app!.logSession = undefined;
          break;
        }
        this.scheduleTimeout();
        if (value.length > 1) {
          const str = Buffer.from(value).toString();
          this.streamListeners.forEach((cb) => void cb(str, this.app as App));
          this.buffer += str;

          if (!this.muted) {
            this.outputChannel?.append(str);
          }
          if (this.buffer.split('\n').length > this.maxLines) {
            this.buffer = this.buffer.split('\n').slice(-this.maxLines).join('\n');
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException) {
        return;
      }
      throw e;
    }
  }

  /**
   * Starts the log session and if successful, the read stream
   * is initialized and log data becomes availale.
   */
  private async startLogSession(): Promise<void> {
    const logSession = await this.fetchLogSession(this.#app!);
    const response = await fetch(logSession.logplex_url, { signal: this.signal });
    if (response.ok) {
      if (!this.muted) {
        StartLogSession.prepareOutputChannelForLogSession(this.outputChannel, this.#app!.name);
      }
      const reader = response.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>;
      // Since the stream is a log runnning process
      // we want this function to complete without
      // having to wait for the stream to end.
      void this.beginReading(reader);
    } else {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
  }

  /**
   * Sets a timeout to restart the log session after
   * 30 seconds of inactivity. If the log session is
   * restarted, the existing log session will be disposed.
   *
   * This is also used when connectivity is lost and the
   * log stream reader is no longer sending the null byte
   * heartbeat.
   */
  private scheduleTimeout(): void {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      delete this.#app!.logSession;
      void this.run(this.#app!, this.#muted);
    }, 30_000);
  }
}
