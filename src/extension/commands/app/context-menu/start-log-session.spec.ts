import * as assert from 'node:assert';

import * as vscode from 'vscode';
import Sinon, { type SinonMock, type SinonStub } from 'sinon';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import type { App, LogSession } from '@heroku-cli/schema';
import { StartLogSession } from './start-log-session';
import { propertyChangeNotifierFactory } from '../../../meta/property-change-notfier';
import { HerokuOutputChannel } from '../../../meta/command';

suite('The StartLogSession command', () => {
  let fetchStub: SinonStub;
  let logServiceStub: SinonStub;
  let authStub: SinonStub;
  let outputChannelMock: SinonMock;
  let fakeChannel: vscode.LogOutputChannel;

  setup(() => {
    async function* stream(): AsyncGenerator<Uint8Array> {
      let ct = 5;
      while (ct--) {
        const buff = Buffer.from(`test message ${ct}`);
        const bytes = new Uint8Array(buff);
        yield bytes;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    logServiceStub = Sinon.stub(LogSessionService.prototype, 'create').resolves({
      logplex_url: 'https://example.com'
    } as LogSession);

    fetchStub = Sinon.stub(globalThis, 'fetch').onFirstCall().resolves(new Response(stream()));
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
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === StartLogSession.COMMAND_ID);
    assert.ok(command, 'The StartLogSession is not registered.');
  });

  test('successfully writes responses to the output channel', async () => {
    const mockApp = { id: 'app1', name: 'test-app', organization: { name: 'test-org' } } as App;
    outputChannelMock.expects('clear').calledOnce;
    outputChannelMock.expects('show').withExactArgs(true);
    outputChannelMock.expects('append').withArgs('test message 4');
    outputChannelMock.expects('append').withArgs('test message 3');
    outputChannelMock.expects('append').withArgs('test message 2');
    outputChannelMock.expects('append').withArgs('test message 1');
    outputChannelMock.expects('append').withArgs('test message 0');

    const command = new StartLogSession(fakeChannel);
    await command.run(mockApp);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok(logServiceStub.calledOnce, 'The StartLogSession command did not call the log session service.');
    assert.ok(fetchStub.calledOnce, 'The StartLogSession command did not make the fetch request.');
    outputChannelMock.verify();
  });
});
