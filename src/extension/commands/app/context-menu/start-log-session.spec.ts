import * as assert from 'node:assert';

import * as vscode from 'vscode';
import Sinon, { type SinonMock, type SinonStub } from 'sinon';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import type { LogSession } from '@heroku-cli/schema';
import { StartLogSession } from './start-log-session';
import { propertyChangeNotifierFactory } from '../../../meta/property-change-notfier';
import { HerokuOutputChannel } from '../../../meta/command';

async function* stream(): AsyncGenerator<Uint8Array> {
  let ct = 5;
  while (ct--) {
    const buff = Buffer.from(`test message ${ct}`);
    const bytes = new Uint8Array(buff);
    yield bytes;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

suite('The StartLogSession command', () => {
  let fetchStub: SinonStub;
  let logServiceStub: SinonStub;
  let authStub: SinonStub;
  let createOutputChannel: SinonStub;
  let outputChannelMock: SinonMock;

  setup(() => {
    logServiceStub = Sinon.stub(LogSessionService.prototype, 'create').resolves({
      logplex_url: 'https://example.com'
    } as LogSession);
    fetchStub = Sinon.stub(globalThis, 'fetch').onFirstCall().resolves(new Response(stream()));
    authStub = Sinon.stub(vscode.authentication, 'getSession').resolves({
      accessToken: 'token'
    } as vscode.AuthenticationSession);

    let fakeChannel: vscode.LogOutputChannel = {
      clear: function () {},
      show: function () {},
      append: function () {}
    } as unknown as vscode.LogOutputChannel;
    outputChannelMock = Sinon.mock(fakeChannel);
    const createOutputChannelOringal = vscode.window.createOutputChannel.bind(vscode.window);

    createOutputChannel = Sinon.stub(vscode.window, 'createOutputChannel').callsFake((channeldId: string) => {
      if (channeldId === HerokuOutputChannel.LogOutput) {
        return fakeChannel;
      } else {
        return createOutputChannelOringal(channeldId) as vscode.LogOutputChannel;
      }
    });
  });

  teardown(() => {
    logServiceStub.restore();
    fetchStub.restore();
    authStub.restore();
    createOutputChannel.restore();
    outputChannelMock.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === StartLogSession.COMMAND_ID);
    assert.ok(command, 'The StartLogSession is not registered.');
  });

  test('successfully writes responses to the output channel', async () => {
    const app = propertyChangeNotifierFactory({ name: 'example-app-321' });
    outputChannelMock.expects('clear').calledOnce;
    outputChannelMock.expects('show').withExactArgs(true);
    outputChannelMock.expects('append').withArgs('test message 4');
    outputChannelMock.expects('append').withArgs('test message 3');
    outputChannelMock.expects('append').withArgs('test message 2');
    outputChannelMock.expects('append').withArgs('test message 1');
    outputChannelMock.expects('append').withArgs('test message 0');

    await vscode.commands.executeCommand<void>(StartLogSession.COMMAND_ID, app);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok(logServiceStub.calledOnce, 'The StartLogSession command did not call the log session service.');
    assert.ok(fetchStub.calledOnce, 'The StartLogSession command did not make the fetch request.');
    outputChannelMock.verify();
  });
});
