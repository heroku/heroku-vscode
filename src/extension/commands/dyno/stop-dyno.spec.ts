import * as assert from 'node:assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { Dyno } from '@heroku-cli/schema';
import { StopDynoCommand } from './stop-dyno';

suite('The StopDynoCommand', () => {
  let getSessionStub: sinon.SinonStub;
  let showWarningMessageStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;
  let setStatusBarMessageStub: sinon.SinonStub;

  const dyno = {
    name: 'tester-dyno',
    attach_url: null,
    command: '',
    created_at: '',
    id: '',
    release: {},
    app: { id: '123456' },
    size: '',
    state: '',
    type: '',
    updated_at: ''
  } as Dyno;

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
    getSessionStub = sinon.stub(vscode.authentication, 'getSession')
    .callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });

    showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
    fetchStub = sinon.stub(globalThis, 'fetch');
    setStatusBarMessageStub = sinon.stub(vscode.window, 'setStatusBarMessage');
    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
  });

  teardown(() => {
    getSessionStub.restore();
    showWarningMessageStub.restore();
    fetchStub.restore();
    setStatusBarMessageStub.restore();
    showErrorMessageStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find(command => command === StopDynoCommand.COMMAND_ID);
    assert.ok(!!command, 'The StopDynoCommand command is not registered');
  });

  test('stops the dyno', async () => {
    fetchStub.callsFake(async () => {
      return new Response('{}');
    });

    showWarningMessageStub.callsFake(async () => 'Stop Dyno');
    await vscode.commands.executeCommand<string>(StopDynoCommand.COMMAND_ID, dyno);
    assert.ok(!!getSessionStub.exceptions.length);
    assert.ok(setStatusBarMessageStub.calledWith(`${dyno.name} is stopping...`));
  });

  test('shows appropriate status message when stopping fails', async () => {
    showWarningMessageStub.callsFake(async () => 'Stop Dyno');
    fetchStub.onFirstCall().callsFake(async () => {
      return new Response(JSON.stringify({ state: 'up' }));
    });
    fetchStub.onSecondCall().callsFake(async () => {
      return new Response(JSON.stringify({}), { status: 401 });
    });
    await vscode.commands.executeCommand<string>(StopDynoCommand.COMMAND_ID, dyno);
    assert.ok(showErrorMessageStub.calledWith(`Could not stop ${dyno.name}.`));
  });
});
