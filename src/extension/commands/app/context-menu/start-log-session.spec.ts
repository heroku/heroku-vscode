import * as assert from 'node:assert';

import * as vscode from 'vscode';
import Sinon, { type SinonMock, type SinonStub } from 'sinon';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import type { App, LogSession } from '@heroku-cli/schema';
import { StartLogSession } from './start-log-session';
import { Readable, Writable } from 'node:stream';

suite('The StartLogSession command', () => {
  let fetchStub: SinonStub;
  let logServiceStub: SinonStub;
  let authStub: SinonStub;
  let outputChannelMock: SinonMock;
  let fakeChannel: vscode.LogOutputChannel;
  let stream: Writable;
  let readable: Readable;
  const message = '2024-11-08T20:46:09.807300+00:00 heroku[web.7]: State changed from stopping to down';
  const mockApp = { id: 'app1', name: 'test-app', organization: { name: 'test-org' } } as App;
  setup(() => {
    stream = new Writable();
    readable = Readable.from(
      (async function* () {
        while (!readable.closed) {
          const line = await Promise.race([
            new Promise((resolve) => {
              stream.once('data', (chunk) => {
                resolve(chunk);
              });
            }),
            new Promise((resolve) => {
              readable.once('close', () => {
                resolve(null);
              });
            })
          ]);

          if (line) {
            yield line;
          } else {
            break;
          }
        }
      })()
    );
    logServiceStub = Sinon.stub(LogSessionService.prototype, 'create').resolves({
      logplex_url: 'https://example.com'
    } as LogSession);

    fetchStub = Sinon.stub(globalThis, 'fetch').onFirstCall().resolves(new Response(readable));
    authStub = Sinon.stub(vscode.authentication, 'getSession').resolves({
      accessToken: 'token'
    } as vscode.AuthenticationSession);

    fakeChannel = {
      clear: function () {},
      show: function () {},
      append: function () {},
      appendLine: function () {}
    } as unknown as vscode.LogOutputChannel;
    outputChannelMock = Sinon.mock(fakeChannel);
  });

  teardown(() => {
    Sinon.restore();
    readable.destroy();
    stream.destroy();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === StartLogSession.COMMAND_ID);
    assert.ok(command, 'The StartLogSession is not registered.');
  });

  test('successfully writes responses to the output channel', async () => {
    outputChannelMock.expects('clear').calledOnce;
    outputChannelMock.expects('show').withExactArgs(true);
    outputChannelMock.expects('append').withArgs(message);

    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);
    stream.emit('data', message);
    await new Promise((resolve) => setTimeout(resolve));

    assert.ok(logServiceStub.calledOnce, 'The StartLogSession command did not call the log session service.');
    assert.ok(fetchStub.calledOnce, 'The StartLogSession command did not make the fetch request.');
    outputChannelMock.verify();
  });

  test('mutes the log session', async () => {
    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);

    command.muted = true;
    stream.emit('data', message);
    await new Promise((resolve) => setTimeout(resolve));
    outputChannelMock.expects('append').never();
    outputChannelMock.verify();
  });

  test('aborts the log session without throwing', async () => {
    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);

    // Kick it once before terminating
    stream.emit('data', message);
    await new Promise((resolve) => setTimeout(resolve));

    assert.doesNotThrow(command.abort.bind(command));
    // make sure we're aborted
    stream.emit('data', message);
    await new Promise((resolve) => setTimeout(resolve));

    outputChannelMock.expects('append').never();
    outputChannelMock.verify();
  });
});
