import EventEmitter from 'node:events';
import type { App } from '@heroku-cli/schema';
import * as vscode from 'vscode';
import { StartLogSession, type LogSessionStream } from '../../commands/app/context-menu/start-log-session';
import { Bindable } from '../../meta/property-change-notfier';
/**
 *
 */
export class LogStreamClient extends EventEmitter {
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
    attachmentsDetach: /(?:Detach )([A-Z_s]+)(?:\(@ref:)([a-zA-Z0-9-]+)/,

    // Attach LOGDNA (@ref:logdna-deep-31633) - captures 'LOGDNA' and 'logdna-deep-31633'
    attachmentsAttach: /(Attach )([A-Z_\s]+)(?:\(@ref:)([a-zA-Z0-9-]+)/,

    // "@ref:searchbox-tapered-14398 completed provisioning" - captures 'searchbox-tapered-14398'
    provisioningCompleted: /(?:@ref:)([a-zA-Z0-9\\-]+)(?: completed provisioning)/,

    // "Scaled to web@2:Standard-1X" - captures 'web', '2' and 'Standard-1X'
    scaledTo: /(?:Scaled to )([a-zA-Z]+)(?:@)([0-9])(?:\\:)([a-zA-Z0-9-_]+)/
  };

  #apps: ReadonlyArray<Bindable<App & { logSession?: LogSessionStream }>> | undefined;

  /**
   * Gets the apps.
   *
   * @returns The apps.
   */
  public get apps(): ReadonlyArray<Bindable<App & { logSession?: LogSessionStream }>> {
    return this.#apps ?? [];
  }

  /**
   * Sets the apps and attaches log streams to
   * each one while detaching existing log streams
   * from the previous apps.
   *
   * @param value The apps.
   */
  public set apps(value: ReadonlyArray<Bindable<App & { logSession?: LogSessionStream }>>) {
    if (this.#apps === value) {
      return;
    }
    this.detachLogStreams();
    this.#apps = value;
    void this.attachLogStreams();
  }

  /**
   * Detaches the log streams.
   */
  private detachLogStreams(): void {
    for (const app of this.apps) {
      app.logSession?.detach(this.onLogStreamData);
    }
  }

  /**
   * Attaches the log streams.
   */
  private async attachLogStreams(): Promise<void> {
    for (const app of this.apps) {
      await vscode.commands.executeCommand(StartLogSession.COMMAND_ID, app, true, 0);
      app.logSession?.attach(this.onLogStreamData);
    }
  }

  private onLogStreamData = (data: string): void => {
    const lines = data.split('\n');
    for (const line of lines) {
      const [, type, dynoName] = this.regexLibrary.processType.exec(line) ?? [];
      const [, from, to] = this.regexLibrary.stateChanged.exec(line) ?? [];
      const [, attachmentName] = this.regexLibrary.attachmentsUpdate.exec(line) ?? [];
      const [, attachmentNameDetach, detachRef] = this.regexLibrary.attachmentsDetach.exec(line) ?? [];
      const [, attachmentNameAttach, attachRef] = this.regexLibrary.attachmentsAttach.exec(line) ?? [];
      const [, provisioningRef] = this.regexLibrary.provisioningCompleted.exec(line) ?? [];
      const [, app, dynoIndex, formation] = this.regexLibrary.scaledTo.exec(line) ?? [];

      if (from && to) {
        this.emit('stateChanged', { app, from, to });
      } else if (attachmentName) {
        this.emit('attachmentUpdate', { app, attachmentName });
      } else if (attachmentNameDetach) {
        this.emit('attachmentDetach', { app, attachmentName: attachmentNameDetach, ref: detachRef });
      } else if (attachmentNameAttach) {
        this.emit('attachmentAttach', { app, attachmentName: attachmentNameAttach, ref: attachRef });
      } else if (provisioningRef) {
        this.emit('provisioningCompleted', { app, ref: provisioningRef });
      } else if (type && dynoName) {
        this.emit('dyno', { app, type, dynoName, dynoIndex, formation });
      }
    }
  };
}
