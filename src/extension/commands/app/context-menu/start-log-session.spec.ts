import * as assert from 'node:assert';

import * as vscode from 'vscode';
import Sinon, { type SinonStub } from 'sinon';
import type { App } from '@heroku-cli/schema';
import { StartLogSession } from './start-log-session';
import { EventEmitter } from 'node:events';
import * as herokuSdkUtil from '../../../utils/heroku-sdk';

suite('The StartLogSession command', () => {
  let streamLogsCallCount: number;
  let appendLineSpy: SinonStub;
  let fakeChannel: vscode.LogOutputChannel;
  let lineEmitter: EventEmitter;
  const message = '2024-11-08T20:46:09.807300+00:00 heroku[web.7]: State changed from stopping to down';
  let mockApp: App;

  /** Yields the event loop long enough for the createHerokuSDK
   * promise chain inside streamLogs() to resolve and wire up the
   * async iterator before lines are emitted. */
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  };

  setup(() => {
    mockApp = { id: 'app1', name: 'test-app', organization: { name: 'test-org' } } as App;
    lineEmitter = new EventEmitter();
    streamLogsCallCount = 0;
    // The SDK's `streamLogs` is an async generator. Tests drive it
    // by emitting lines on `lineEmitter`; sending `null` ends it.
    // eslint-disable-next-line require-jsdoc
    async function* fakeStreamLogs(): AsyncGenerator<string, void, unknown> {
      streamLogsCallCount++;
      while (true) {
        const line = await new Promise<string | null>((resolve) => {
          const onLine = (l: string | null) => {
            lineEmitter.off('end', onEnd);
            resolve(l);
          };
          const onEnd = () => {
            lineEmitter.off('line', onLine);
            resolve(null);
          };
          lineEmitter.once('line', onLine);
          lineEmitter.once('end', onEnd);
        });
        if (line === null) break;
        yield line;
      }
    }
    Sinon.stub(herokuSdkUtil, 'createHerokuSDK').resolves({
      platform: {
        logSession: { streamLogs: fakeStreamLogs }
      },
      data: {}
    } as never);

    Sinon.stub(vscode.authentication, 'getSession').resolves({
      accessToken: 'token'
    } as vscode.AuthenticationSession);

    appendLineSpy = Sinon.stub();
    fakeChannel = {
      clear: Sinon.stub(),
      show: Sinon.stub(),
      append: Sinon.stub(),
      appendLine: appendLineSpy
    } as unknown as vscode.LogOutputChannel;
  });

  teardown(() => {
    Sinon.restore();
    lineEmitter.emit('end');
    lineEmitter.removeAllListeners();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === StartLogSession.COMMAND_ID);
    assert.ok(command, 'The StartLogSession is not registered.');
  });

  test('writes incoming log lines to the output channel', async () => {
    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);
    await settle();
    lineEmitter.emit('line', message);
    await settle();

    assert.ok(streamLogsCallCount > 0, 'StartLogSession did not call streamLogs.');
    assert.ok(
      appendLineSpy.calledWith(message),
      `Expected appendLine(message); calls were: ${appendLineSpy
        .getCalls()
        .map((c) => JSON.stringify(c.args))
        .join(', ')}`
    );
  });

  test('mutes the log session', async () => {
    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);
    await settle();

    command.muted = true;
    appendLineSpy.resetHistory();
    lineEmitter.emit('line', message);
    await settle();

    assert.ok(!appendLineSpy.calledWith(message), 'Muted log session still wrote the message.');
  });

  test('aborts the log session without throwing', async () => {
    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);
    await settle();

    // Kick it once before terminating
    lineEmitter.emit('line', message);
    await settle();

    assert.doesNotThrow(command.abort.bind(command));
    appendLineSpy.resetHistory();
    // make sure we're aborted
    lineEmitter.emit('line', message);
    await settle();

    assert.ok(!appendLineSpy.calledWith(message), 'Aborted log session still wrote the message.');
  });
});
