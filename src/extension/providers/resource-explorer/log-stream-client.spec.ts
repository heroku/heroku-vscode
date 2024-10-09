import * as assert from 'node:assert';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { LogStreamClient, LogStreamEvents } from './log-stream-client';
import * as vscode from 'vscode';
import { App, Dyno, Formation } from '@heroku-cli/schema';
import { type LogSessionStream, StartLogSession } from '../../commands/app/context-menu/start-log-session';
import { randomUUID } from 'node:crypto';

import { Readable, Writable } from 'node:stream';

suite('LogStreamClient', () => {
  let logStreamClient: LogStreamClient;
  let mockApp: App;
  let fetchStub: sinon.SinonStub;
  let getSessionStub: sinon.SinonStub;
  let stream: Writable;

  const writeToStream = async (data: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1005)); // Wait for attach to complete
    stream.emit('data', data);
    await new Promise((resolve) => setTimeout(resolve, 0)); // wait for async stream to yield
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

    stream = new Writable();
    const readable = Readable.from(
      (async function* () {
        let ct = 2;
        while (ct--) {
          const line = await new Promise((resolve) => {
            stream.once('data', (chunk) => {
              resolve(chunk);
            });
          });
          yield line;
        }
      })()
    );

    fetchStub = sinon.stub(globalThis, 'fetch');
    fetchStub.onFirstCall().resolves(new Response(JSON.stringify({ logplex_url: 'https://fake.logplex.com' })));
    fetchStub.onSecondCall().resolves(new Response(readable));
  });

  teardown(() => {
    sinon.restore();
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
      await writeToStream('app[web.1]: State changed from starting to up\n');

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
      await writeToStream('app[api]: Attach LOGDNA (@ref:logdna-deep-31633)\n');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          configVar: 'LOGDNA',
          ref: 'logdna-deep-31633'
        })
      );
    });

    test('should emit ATTACHMENT_DETACHED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.ATTACHMENT_DETACHED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Detach LOGDNA (@ref:logdna-deep-31633)\n');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          configVar: 'LOGDNA',
          ref: 'logdna-deep-31633'
        })
      );
    });

    test('should emit ATTACHMENT_UPDATED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.ATTACHMENT_UPDATED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Update LOGDNA by user@heroku.com\n');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          configVar: 'LOGDNA'
        })
      );
    });

    test('should emit PROVISIONING_COMPLETED event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.PROVISIONING_COMPLETED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: @ref:searchbox-tapered-14398 completed provisioning\n');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          ref: 'searchbox-tapered-14398'
        })
      );
    });

    test('should emit SCALED_TO event', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.SCALED_TO, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[api]: Scaled to web@2:Standard-1X\n');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
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
      await writeToStream('app[web.1]: Starting process with command `npm start`\n');

      assert.ok(
        spy.calledOnceWith({
          app: mockApp,
          type: 'app',
          dynoName: 'web.1',
          command: '`npm start`'
        })
      );
    });

    test('should handle partial lines', async () => {
      const spy = sinon.spy();
      logStreamClient.on(LogStreamEvents.STATE_CHANGED, spy);

      logStreamClient.apps = [mockApp];
      await writeToStream('app[web.1]: State changed ');
      await writeToStream('from starting to up\n');

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
