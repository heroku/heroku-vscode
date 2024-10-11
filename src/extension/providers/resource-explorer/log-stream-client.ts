import EventEmitter from 'node:events';
import type { App, Dyno, Formation } from '@heroku-cli/schema';
import * as vscode from 'vscode';
import { StartLogSession, type LogSessionStream } from '../../commands/app/context-menu/start-log-session';

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
export type AttachmentDetachedInfo = { app: App; type: string; configVar: string; ref: string };

/**
 * AttachmentAttachedInfo encapsulates the details of an attachment attached event.
 */
export type AttachmentAttachedInfo = { app: App; type: string; configVar: string; ref: string };

/**
 * AttachmentProvisionedInfo encapsulates the details of an attachment provisioned event.
 */
export type AttachmentProvisionedInfo = { app: App; type: string; ref: string };

/**
 * StartingProcessInfo encapsulates the details of a starting process event.
 */
export type StartingProcessInfo = { app: App; type: string; dynoName: string; command: string };

/**
 * ScaledToInfo encapsulates the details of a scaled to event.
 */
export type ScaledToInfo = {
  app: App;
  type: string;
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

type ReadOnlyAppArray = ReadonlyArray<App & { logSession?: LogSessionStream }> | undefined;

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
  private partialLine = '';
  /**
   * The regex library containing matchers
   * for various log stream events.
   *
   * These are used to derive updates and dispatch
   * events containing the details.
   */
  private regexLibrary = {
    // "app[web.1]:" - captures 'app' and 'web.1'
    processType: /([a-zA-Z0-9-]+)(?:\[)([a-zA-Z0-9-.]+)(?:\]:)/,

    // "State changed from starting to up" - captures 'starting' and 'up' values
    stateChanged: /\b(?:State changed from )(\w+)(?: to )(\w+)\b/,

    // "Update LOGDNA by user@heroku.com" - captures 'LOGDNA'
    attachmentsUpdate: /(?:Update )([A-Z_\s]+)(?:by)/,

    // Detach LOGDNA (@ref:logdna-deep-31633) - captures 'LOGDNA' and 'logdna-deep-31633'
    attachmentsDetach: /(?:Detach )([A-Z_\s]+)(?:\(@ref:)([a-zA-Z0-9-]+)/,

    // Attach LOGDNA (@ref:logdna-deep-31633) - captures 'LOGDNA' and 'logdna-deep-31633'
    attachmentsAttach: /(?:Attach )([A-Z_\s]+)(?:\(@ref:)([a-zA-Z0-9-]+)/,

    // "@ref:searchbox-tapered-14398 completed provisioning" - captures 'searchbox-tapered-14398'
    provisioningCompleted: /(?:@ref:)([a-zA-Z0-9-]+)(?: completed provisioning)/,

    // "Scaled to web@2:Standard-1X" - captures 'web', '2' and 'Standard-1X'
    scaledTo: /\b(?:Scaled to )([a-zA-Z]+)(?:@)([0-9]+)(?::)([a-zA-Z0-9-_]+)\b/,

    //  Starting process with command `npm start` - captures 'Starting process with command ' and '`npm start`'
    startingProcess: /(Starting process with command )(`.*?`)/
  };

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
    const toDetach = value?.filter((app) => this.#apps?.find((existingApp) => existingApp.id !== app.id));
    const toAttach = value?.filter((app) => !this.#apps?.find((existingApp) => existingApp.id !== app.id));

    this.detachLogStreams(toDetach);
    this.#apps = value;
    void this.attachLogStreams(toAttach);
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
    const logSessions = await Promise.allSettled(
      toAttach.map((app) => vscode.commands.executeCommand<LogSessionStream>(StartLogSession.COMMAND_ID, app, true))
    );
    // Since the first few writes from the stream may contain
    // log history, we wait a second to begin processing real-time logs
    await new Promise((resolve) => setTimeout(resolve, 1000));
    for (const result of logSessions) {
      const { status } = result;
      if (status === 'rejected') {
        continue;
      }
      const logSession = result.value;
      logSession.attach(this.onLogStreamData);
      logSession.onDidUpdateMute(() => this.emit(LogStreamEvents.MUTED_CHANGED, logSession.app as App));
      this.emit(LogStreamEvents.STREAM_STARTED, logSession.app as App);
      logSession.signal.addEventListener('abort', () => this.emit(LogStreamEvents.STREAM_ENDED, logSession.app as App));
    }
  }

  /**
   * Handles the data read from the log stream.
   * The log stream doesn't always write a complete
   * line. This method buffers partial lines and
   * processes them when a complete line is received.
   *
   * @param data The data read from the log stream.
   * @param app The app associated with the log stream.
   */
  private onLogStreamData = (data: string, app: App): void => {
    const lines = data.split('\n');
    lines[0] = this.partialLine + lines[0];
    if (!data.endsWith('\n')) {
      this.partialLine = lines.pop() as string;
    }

    for (const line of lines) {
      if (!line) {
        continue;
      }
      const [, type, dynoName] = this.regexLibrary.processType.exec(line) ?? [];
      const [, from, to] = this.regexLibrary.stateChanged.exec(line) ?? [];
      const [, updateConfigVar] = this.regexLibrary.attachmentsUpdate.exec(line) ?? [];
      const [, detachConfigVar, detachRef] = this.regexLibrary.attachmentsDetach.exec(line) ?? [];
      const [, attachConfigVar, attachRef] = this.regexLibrary.attachmentsAttach.exec(line) ?? [];
      const [, provisioningRef] = this.regexLibrary.provisioningCompleted.exec(line) ?? [];
      const [, dynoType, quantity, size] = this.regexLibrary.scaledTo.exec(line) ?? [];
      const [, , command] = this.regexLibrary.startingProcess.exec(line) ?? [];

      if (from && to) {
        this.emit(LogStreamEvents.STATE_CHANGED, { app, type, dynoName, from, to });
      } else if (updateConfigVar) {
        this.emit(LogStreamEvents.ATTACHMENT_UPDATED, { app, type, configVar: updateConfigVar.trim() });
      } else if (detachConfigVar) {
        this.emit(LogStreamEvents.ATTACHMENT_DETACHED, {
          app,
          type,
          configVar: detachConfigVar.trim(),
          ref: detachRef
        });
      } else if (attachConfigVar) {
        this.emit(LogStreamEvents.ATTACHMENT_ATTACHED, {
          app,
          type,
          configVar: attachConfigVar.trim(),
          ref: attachRef
        });
      } else if (provisioningRef) {
        this.emit(LogStreamEvents.PROVISIONING_COMPLETED, { app, type, ref: provisioningRef });
      } else if (size) {
        this.emit(LogStreamEvents.SCALED_TO, { app, type, dynoType, quantity: parseInt(quantity, 10), size });
      } else if (command) {
        this.emit(LogStreamEvents.STARTING_PROCESS, { app, type, dynoName, command });
      }
    }
  };
}
