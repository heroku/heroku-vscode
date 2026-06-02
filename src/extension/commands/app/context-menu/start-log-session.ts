import * as vscode from 'vscode';
import type { App } from '@heroku-cli/schema';
import { herokuCommand, HerokuOutputChannel, type RunnableCommand } from '../../../meta/command';
import { logExtensionEvent } from '../../../utils/logger';
import * as herokuSdkUtil from '../../../utils/heroku-sdk';

/**
 * Represents a callback to be executed when a line of data is
 * received from the log stream.
 */
export type LogStreamCallback = (line: string, app: App) => void;

/**
 * Represents a log session stream.
 */
export type LogSessionStream = AbortController & {
  /**
   * The App object associated with this log session.
   */
  app: App | undefined;
  /**
   * Attaches a callback to the stream. Each line from the stream
   * will trigger the callback and the string value will be passed
   * as the sole argument.
   *
   * @param cb The callback to execute when a line from the stream is received.
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

  /**
   * Adds a callback that is executed once when the log stream ends,
   * whether by abort, by the platform closing the connection, or by
   * an error. The callback receives no arguments and is invoked at
   * most once per session.
   *
   * @param cb The callback to execute when the log stream ends.
   * @returns void
   */
  onDidEnd: (cb: () => void) => void;
};

@herokuCommand({ outputChannelId: HerokuOutputChannel.LogOutput, languageId: 'heroku-logs' })
/**
 * Command used to start a log session for the supplied App object
 * and pipe the output to the output channel when `muted` is false.
 * Only one log session is written to the output channel at a time.
 *
 * Log sessions are appended to the App object using the `logSession`
 * property so callers managing the lifecycle of the app can manage
 * the session without retaining a direct reference.
 *
 * Internally delegates to the SDK's `platform.logSession.streamLogs`,
 * which handles session creation, the logplex stream connection, and
 * platform-timeout recreates. This class adds vscode-specific
 * behavior on top: output channel routing, a replay buffer for
 * unmuting, and the singleton `visibleLogSession` so only one
 * channel writes at a time.
 */
export class StartLogSession extends AbortController implements LogSessionStream, RunnableCommand<LogSessionStream> {
  public static COMMAND_ID = 'heroku:start-log-session' as const;
  private static visibleLogSession: StartLogSession | undefined;

  private buffer = '';
  private streamListeners: Set<LogStreamCallback> = new Set();
  private muteListeners: Set<(muted: boolean) => void> = new Set();
  private endListeners: Set<() => void> = new Set();
  private ended = false;
  private maxLines = 100;

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

    const { outputChannel, buffer, app, maxLines } = existingLogSession;
    if (!muted) {
      this.prepareOutputChannelForLogSession(outputChannel, app!.name);
      // Replay up to `maxLines` recent lines of the existing buffer.
      const replayLines = buffer.split('\n').filter(Boolean).slice(-maxLines);
      for (const line of replayLines) {
        outputChannel?.appendLine(line);
      }
      StartLogSession.visibleLogSession = existingLogSession;
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
   * Adds a callback that fires once when the underlying stream ends
   * (abort, remote close, or error). If the stream has already ended,
   * the callback fires synchronously on the next microtask.
   *
   * @param cb The callback to execute when the stream ends.
   */
  public onDidEnd(cb: () => void): void {
    if (this.ended) {
      queueMicrotask(cb);
      return;
    }
    this.endListeners.add(cb);
  }

  /**
   * Attaches a callback to the stream. Each line from the stream
   * will trigger the callback.
   *
   * @param cb The callback to execute when a line from the stream is received.
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
   * @returns Promise<LogSessionStream>
   */
  public run(app: App & { logSession?: StartLogSession }, muted = false, lines = 100): Promise<LogSessionStream> {
    this.maxLines = lines;
    this.#muted = muted;
    this.#app = app;
    // Log session already exists, just mute/unmute it
    const { logSession: existingLogSession } = app;
    if (existingLogSession && !existingLogSession.signal.aborted) {
      existingLogSession.maxLines = lines;
      existingLogSession.muted = !existingLogSession.muted ? false : muted; // a value of false becomes 'sticky';
      return Promise.resolve(existingLogSession);
    }

    Reflect.set(app, 'logSession', this);
    // Streams in the background — we don't await it here so callers
    // can wire up listeners synchronously after run() resolves.
    // streamLogs() handles its own errors; the .catch is a guard
    // against future regressions.
    void this.streamLogs().catch((e) =>
      logExtensionEvent(`Unhandled streamLogs error for ${app.name}: ${(e as Error).message}`)
    );
    return Promise.resolve(this);
  }

  /**
   * @inheritdoc
   */
  public [Symbol.dispose](): void {
    // no-op - do not dispose using this.
  }

  /**
   * Drives the SDK log iterator: prepares the channel (when
   * unmuted), pumps each line into the buffer / listeners /
   * channel, and trims the replay buffer to `maxLines`. Returns
   * when the signal is aborted or the SDK iterator finishes; logs
   * (without throwing) on unexpected errors.
   */
  private async streamLogs(): Promise<void> {
    const app = this.#app!;
    if (!this.muted) {
      StartLogSession.prepareOutputChannelForLogSession(this.outputChannel, app.name);
    }

    try {
      const { platform } = await herokuSdkUtil.createHerokuSDK(this.signal, undefined, ['logSessionExtensions']);
      const iterator = platform.logSession.streamLogs(app.id, {
        lines: this.maxLines,
        signal: this.signal,
        tail: true
      });
      logExtensionEvent(`Log stream started for ${app.name}`);

      for await (const line of iterator) {
        if (this.signal.aborted) {
          break;
        }
        for (const cb of this.streamListeners) {
          try {
            cb(line, app);
          } catch (e) {
            // A single bad listener (e.g. a parsing bug downstream)
            // must not tear down the iterator — the SDK doesn't
            // recreate after we exit, and the resource explorer
            // would lose live updates for this app.
            logExtensionEvent(`Log stream listener threw for ${app.name}: ${(e as Error).message}`);
          }
        }

        this.appendToBuffer(line);
        if (!this.muted) {
          this.outputChannel?.appendLine(line);
        }
      }
    } catch (e) {
      if (this.signal.aborted) {
        return;
      }
      logExtensionEvent(`Log stream error for ${app.name}: ${(e as Error).message}`);
    } finally {
      // Only clear if we still own the slot — a fresh StartLogSession
      // for the same app may have already replaced this one (e.g.
      // detach + immediate reattach via the resource explorer).
      if (app.logSession === this) {
        app.logSession = undefined;
      }
      this.ended = true;
      for (const cb of this.endListeners) {
        try {
          cb();
        } catch (e) {
          logExtensionEvent(`Log stream end-listener threw for ${app.name}: ${(e as Error).message}`);
        }
      }
      this.endListeners.clear();
      logExtensionEvent(`Log session ended for ${app.name}`);
    }
  }

  /**
   * Appends a line to the in-memory replay buffer and trims to the
   * last `maxLines` lines. Stored without trailing newline so a
   * `split('\n')` doesn't yield an empty trailing entry that the
   * replay path would re-emit as a blank line.
   *
   * @param line The line to append.
   */
  private appendToBuffer(line: string): void {
    this.buffer = this.buffer ? `${this.buffer}\n${line}` : line;
    const lines = this.buffer.split('\n');
    if (lines.length > this.maxLines) {
      this.buffer = lines.slice(-this.maxLines).join('\n');
    }
  }
}
