import EventEmitter from 'node:events';
import type { App, Dyno, Formation, TeamApp } from '@heroku-cli/schema';
import * as vscode from 'vscode';
import type { HerokuLogEvent } from '@heroku/sdk/extensions/platform';
import { StartLogSession, type LogSessionStream } from '../../commands/app/context-menu/start-log-session';
import { diff } from '../../utils/diff';
import { logExtensionEvent } from '../../utils/logger';

// `@heroku/sdk` is ESM with top-level await; this extension is CJS,
// so the parser is loaded once via a dynamic import that evades
// TS's NodeNext rewrite. Resolved before any log line arrives because
// streamLogs (which feeds onLogStreamData) is itself async-loaded.
let parseHerokuLogLine: ((line: string) => HerokuLogEvent | undefined) | undefined;

/**
 * Lazily resolves the SDK's `parseHerokuLogLine` and caches it.
 * Called from `attachLogStreams` so `onLogStreamData` can stay
 * synchronous when log lines arrive.
 *
 * @returns The SDK's `parseHerokuLogLine` function.
 */
async function loadParser(): Promise<typeof parseHerokuLogLine> {
  if (parseHerokuLogLine) return parseHerokuLogLine;
  // eslint-disable-next-line no-eval
  const mod = (await (0, eval)('import("@heroku/sdk/extensions/platform")')) as {
    parseHerokuLogLine: (line: string) => HerokuLogEvent | undefined;
  };
  parseHerokuLogLine = mod.parseHerokuLogLine;
  return parseHerokuLogLine;
}

/**
 * LogStreamEventMap is a type alias for a map of log stream events.
 */
export type LogStreamEventMap = {
  [LogStreamEvents.STREAM_STARTED]: App;
  [LogStreamEvents.STREAM_ENDED]: App;
  [LogStreamEvents.MUTED_CHANGED]: App;
  [LogStreamEvents.STATE_CHANGED]: StateChangedInfo;
  [LogStreamEvents.ATTACHMENT_ATTACHED]: AttachmentAttachedInfo;
  [LogStreamEvents.ATTACHMENT_DETACHED]: AttachmentDetachedInfo;
  [LogStreamEvents.ATTACHMENT_UPDATED]: AttachmentUpdatedInfo;
  [LogStreamEvents.SCALED_TO]: ScaledToInfo;
  [LogStreamEvents.PROVISIONING_COMPLETED]: AttachmentProvisionedInfo;
  [LogStreamEvents.STARTING_PROCESS]: StartingProcessInfo;
};

/**
 * LogStreamEventHandler is a type alias for a function that handles
 * log stream events.
 *
 * @param event The event to handle.
 */
export type LogStreamEventHandler<K extends keyof LogStreamEventMap> = (event: LogStreamEventMap[K]) => void;

/**
 * StateChangedInfo encapsulates the details of a state change event.
 */
export type StateChangedInfo = { app: App; type: string; dynoName: string; from: Dyno['state']; to: Dyno['state'] };

/**
 * AttachmentUpdateInfo encapsulates the details of an attachment update event.
 */
export type AttachmentUpdatedInfo = { app: App; type: string; configVar: string };

/**
 * AttachmentDetachedInfo encapsulates the details of an attachment detached event.
 */
export type AttachmentDetachedInfo = { app: App; configVar: string; ref: string };

/**
 * AttachmentAttachedInfo encapsulates the details of an attachment attached event.
 */
export type AttachmentAttachedInfo = { app: App; configVar: string; ref: string };

/**
 * AttachmentProvisionedInfo encapsulates the details of an attachment provisioned event.
 */
export type AttachmentProvisionedInfo = { app: App; ref: string };

/**
 * StartingProcessInfo encapsulates the details of a starting process event.
 */
export type StartingProcessInfo = { app: App; type: string; dynoName: string; command: string };

/**
 * ScaledToInfo encapsulates the details of a scaled to event.
 */
export type ScaledToInfo = {
  app: App;
  dynoType: Dyno['type'];
  quantity: Formation['quantity'];
  size: Formation['size'];
};

/**
 * LogStreamEvent is a custom event type used to
 * encapsulate log stream updates.
 */
export enum LogStreamEvents {
  /**
   * Event type dispatched when a log stream is started.
   */
  STREAM_STARTED = 'streamStarted',
  /**
   * Event type dispatched when a log stream is ended.
   */
  STREAM_ENDED = 'streamEnded',
  /**
   * Event type dispatched when a mute state was changed
   * on the LogStreamSession. This event is dispatched
   * in response to a user action to view/hide log output in
   * VSCode's OUTPUT drawer.
   */
  MUTED_CHANGED = 'mutedChanged',
  /**
   * Event type dispatched when a Dyno state was changed.
   */
  STATE_CHANGED = 'stateChanged',
  /**
   * Event type dispatched when an attachment was updated.
   */
  ATTACHMENT_ATTACHED = 'attachmentAttached',
  /**
   * Event type dispatched when an attachment was detached.
   */
  ATTACHMENT_DETACHED = 'attachmentDetached',
  /**
   * Event type dispatched when an attachment was updated.
   */
  ATTACHMENT_UPDATED = 'attachmentUpdated',
  /**
   * Event type dispatched when an attachment was provisioned.
   */
  PROVISIONING_COMPLETED = 'provisioningCompleted',
  /**
   * Event type dispatched when a Dyno was scaled.
   */
  SCALED_TO = 'scaledTo',
  /**
   * Event type dispatched when a process is starting
   * as is the case when Dynos are scaled up or restarted.
   */
  STARTING_PROCESS = 'startingProcess'
}

type ReadOnlyAppArray = ReadonlyArray<(App | TeamApp) & { logSession?: LogSessionStream }> | undefined;

/**
 * LogStreamClient is a component for handling and processing log streams from multiple Heroku applications.
 * It extends EventEmitter to provide custom event handling for various log stream events.
 *
 * Key features:
 * - Manages multiple Heroku app log streams
 * - Parses log data using regex to identify specific events
 * - Emits typed custom events for state changes, attachment updates, scaling, etc.
 * - Provides methods for attaching and detaching log streams
 * - Buffers and processes partial log lines
 * - Integrates with VSCode commands for starting log sessions
 *
 * This class enables real-time monitoring and reaction to events in Heroku applications
 * and is the primary driver for real-time updates in the HerokuResourceExplorerProvider.
 *
 * @see HerokuResourceExplorerProvider
 * @see StartLogSession
 */
export class LogStreamClient extends EventEmitter {
  #apps: ReadOnlyAppArray;

  /**
   * Gets the apps.
   *
   * @returns The apps.
   */
  public get apps(): ReadOnlyAppArray {
    return this.#apps ?? [];
  }

  /**
   * Sets the apps and attaches log streams to
   * each one while detaching existing log streams
   * from the previous apps.
   *
   * @param value The apps.
   */
  public set apps(value: ReadOnlyAppArray) {
    if (this.#apps === value) {
      return;
    }
    const appsSet = new Set(this.#apps);
    const newAppsSet = new Set(value);

    const { added: toAttach, removed: toDetach } = diff(appsSet, newAppsSet);

    this.detachLogStreams(Array.from(toDetach));
    this.#apps = value;
    void this.attachLogStreams(Array.from(toAttach));
  }

  /**
   * @inheritdoc
   */
  public addListener<K extends keyof LogStreamEventMap>(
    eventName: K,
    listener: (event: LogStreamEventMap[K]) => void
  ): this {
    return super.addListener(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public removeListener<K extends keyof LogStreamEventMap>(
    eventName: K,
    listener: (event: LogStreamEventMap[K]) => void
  ): this {
    return super.removeListener(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public on<K extends keyof LogStreamEventMap>(eventName: K, listener: (event: LogStreamEventMap[K]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public once<K extends keyof LogStreamEventMap>(eventName: K, listener: (event: LogStreamEventMap[K]) => void): this {
    return super.once(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public emit<K extends keyof LogStreamEventMap>(eventName: K, ...args: Parameters<LogStreamEventHandler<K>>): boolean {
    return super.emit(eventName, ...args);
  }

  /**
   * Detaches the log streams.
   *
   * @param toDetach The apps to detach.
   */
  private detachLogStreams(toDetach: ReadOnlyAppArray): void {
    if (!toDetach?.length) {
      return;
    }
    for (const app of toDetach) {
      app.logSession?.detach(this.onLogStreamData);
      app.logSession?.abort();
      app.logSession = undefined;
      logExtensionEvent(`Detached log stream for ${app.name}`);
    }
  }

  /**
   * Attaches the log streams.
   *
   * @param toAttach The apps to attach.
   */
  private async attachLogStreams(toAttach: ReadOnlyAppArray): Promise<void> {
    if (!toAttach?.length) {
      return;
    }
    // Warm the parser before any line arrives so `onLogStreamData`
    // can stay synchronous.
    await loadParser();
    const logSessions = await Promise.allSettled(
      toAttach.map((app) => vscode.commands.executeCommand<LogSessionStream>(StartLogSession.COMMAND_ID, app, true))
    );
    // Since the first few writes from the stream may contain
    // log history, we wait a second to begin processing real-time logs
    await new Promise((resolve) => setTimeout(resolve, 1000));
    for (const result of logSessions) {
      const { status } = result;
      if (status === 'rejected') {
        logExtensionEvent(`Live updates unavaiable: ${result.reason}`);
        continue;
      }
      const logSession = result.value;
      logSession.attach(this.onLogStreamData);
      logSession.onDidUpdateMute(() => this.emit(LogStreamEvents.MUTED_CHANGED, logSession.app as App));
      this.emit(LogStreamEvents.STREAM_STARTED, logSession.app as App);
      logSession.signal.addEventListener('abort', () => this.emit(LogStreamEvents.STREAM_ENDED, logSession.app as App));
      logExtensionEvent(`Live updates active for ${logSession.app!.name}`);
    }
  }

  /**
   * Dispatches structured events for a single log line. Lines are
   * already split for us by the SDK's `streamLogs` iterator; we
   * delegate pattern matching to `parseHerokuLogLine`.
   *
   * @param line A single log line from the stream.
   * @param app The app associated with the log stream.
   */
  private onLogStreamData = (line: string, app: App): void => {
    if (!line || !parseHerokuLogLine) {
      return;
    }
    const event = parseHerokuLogLine(line);
    if (!event) {
      return;
    }

    switch (event.kind) {
      case 'state-changed':
        this.emit(LogStreamEvents.STATE_CHANGED, {
          app,
          type: event.source,
          dynoName: event.dynoName,
          from: event.from,
          to: event.to
        });
        break;
      case 'attachment-updated':
        this.emit(LogStreamEvents.ATTACHMENT_UPDATED, {
          app,
          type: event.type,
          configVar: event.configVar
        });
        break;
      case 'attachment-detached':
        this.emit(LogStreamEvents.ATTACHMENT_DETACHED, {
          app,
          configVar: event.configVar,
          ref: event.ref
        });
        break;
      case 'attachment-attached':
        this.emit(LogStreamEvents.ATTACHMENT_ATTACHED, {
          app,
          configVar: event.configVar,
          ref: event.ref
        });
        break;
      case 'provisioning-completed':
        this.emit(LogStreamEvents.PROVISIONING_COMPLETED, { app, ref: event.ref });
        break;
      case 'scaled-to':
        this.emit(LogStreamEvents.SCALED_TO, {
          app,
          dynoType: event.dynoType,
          quantity: event.quantity,
          size: event.size
        });
        break;
      case 'starting-process':
        this.emit(LogStreamEvents.STARTING_PROCESS, {
          app,
          type: event.source,
          dynoName: event.dynoName,
          command: event.command
        });
        break;
    }
  };
}
