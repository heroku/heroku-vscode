import * as assert from 'node:assert';
import sinon from 'sinon';
import { EventEmitter } from 'node:events';
import { LogStreamClient, LogStreamEvents } from './log-stream-client';
import * as vscode from 'vscode';
import type { App, Dyno, Formation } from '@heroku-cli/schema';
import type { LogSessionStream } from '../../commands/app/context-menu/start-log-session';
import { randomUUID } from 'node:crypto';
import * as herokuSdkUtil from '../../utils/heroku-sdk';

suite('LogStreamClient', () => {
  let logStreamClient: LogStreamClient;
  let mockApp: App;
  let getSessionStub: sinon.SinonStub;
  let lineEmitter: EventEmitter;

  const writeToStream = async (line: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1005)); // Wait for attach + parser load
    lineEmitter.emit('line', line);
    await new Promise((resolve) => setImmediate(resolve)); // wait for async generator to yield
  };

  const sessionObject = {
    account: {
      id: 'Heroku',
      label: 'tester-123@heroku.com'
    },
    id: randomUUID(),
    scopes: [],
    accessToken: randomUUID()
  };

  setup(() => {
    mockApp = { id: 'app1', name: 'test-app' } as App & { logSession: LogSessionStream };
    logStreamClient = new LogStreamClient();
    getSessionStub = sinon.stub(vscode.authentication, 'getSession').callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });

    lineEmitter = new EventEmitter();
    sinon.stub(herokuSdkUtil, 'createHerokuSDK').resolves({
      platform: {
        logSession: {
          // eslint-disable-next-line require-jsdoc
          streamLogs: async function* () {
            while (true) {
              const line = await new Promise<string | null>((resolve) => {
                const onLine = (l: string | null) => resolve(l);
                lineEmitter.once('line', onLine);
                lineEmitter.once('end', () => {
                  lineEmitter.off('line', onLine);
                  resolve(null);
                });
              });
              if (line === null) break;
              yield line;
            }
          }
        }
      },
      data: {}
    } as never);
  });

  teardown(() => {
    sinon.restore();
    lineEmitter.emit('end');
    lineEmitter.removeAllListeners();
  });

  suite('apps setter', () => {
    test('should attach log streams to new apps', async () => {
      const attachStub = sinon.stub(logStreamClient, 'attachLogStreams' as keyof LogStreamClient);
      logStreamClient.apps = [mockApp];
      await new Promise((resolve) => setTimeout(resolve, 1050));

      assert.ok(attachStub.calledOnce);
    });

    test('should detach log streams from old apps', async () => {
      const detatachStub = sinon.stub(logStreamClient, 'detachLogStreams' as keyof LogStreamClient);
      logStreamClient.apps = [mockApp];
      await new Promise((resolve) => setTimeout(resolve, 1005)); // Wait for attach to complete
      logStreamClient.apps = [];

      assert.ok(detatachStub.called);
    });
  });

  suite('onLogStreamData', () => {
    test('should emit STATE_CHANGED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.STATE_CHANGED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[web.1]: State changed from starting to up');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          dynoName: 'web.1',
          from: 'starting',
          to: 'up'
        })
      );
    });

    test('should emit ATTACHMENT_ATTACHED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.ATTACHMENT_ATTACHED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Attach LOGDNA (@ref:logdna-deep-31633)');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          configVar: 'LOGDNA',
          ref: 'logdna-deep-31633'
        })
      );
    });

    test('should emit ATTACHMENT_DETACHED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.ATTACHMENT_DETACHED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Detach LOGDNA (@ref:logdna-deep-31633)');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          configVar: 'LOGDNA',
          ref: 'logdna-deep-31633'
        })
      );
    });

    test('should emit ATTACHMENT_UPDATED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.ATTACHMENT_UPDATED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Update LOGDNA by user@heroku.com');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          configVar: 'LOGDNA',
          type: 'api'
        })
      );
    });

    test('should emit PROVISIONING_COMPLETED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.PROVISIONING_COMPLETED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: @ref:searchbox-tapered-14398 completed provisioning');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          ref: 'searchbox-tapered-14398'
        })
      );
    });

    test('should emit SCALED_TO event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.SCALED_TO, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Scaled to web@2:Standard-1X');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          dynoType: 'web' as Dyno['type'],
          quantity: 2 as Formation['quantity'],
          size: 'Standard-1X' as Formation['size']
        })
      );
    });

    test('should emit STARTING_PROCESS event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.STARTING_PROCESS, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[web.1]: Starting process with command `npm start`');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          dynoName: 'web.1',
          command: 'npm start'
        })
      );
    });
  });

  suite('event listeners', () => {
    test('should add and remove listeners correctly', () => {
      const listener = () => {};
      logStreamClient.addListener(LogStreamEvents.STATE_CHANGED, listener);

      assert.ok(logStreamClient.listeners(LogStreamEvents.STATE_CHANGED).includes(listener));

      logStreamClient.removeListener(LogStreamEvents.STATE_CHANGED, listener);

      assert.ok(!logStreamClient.listeners(LogStreamEvents.STATE_CHANGED).includes(listener));
    });
  });
});
