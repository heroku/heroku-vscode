import * as assert from 'node:assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { RestartDynoCommand } from './restart-dyno';
import { Dyno } from '@heroku-cli/schema';

suite('The RestartDynoCommand', () => {
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
    app: { id: '1234' },
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
    getSessionStub = sinon.stub(vscode.authentication, 'getSession').callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });

    showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
    showWarningMessageStub.callsFake(async () => 'Restart');

    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');

    fetchStub = sinon.stub(globalThis, 'fetch');
    setStatusBarMessageStub = sinon.stub(vscode.window, 'setStatusBarMessage');
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
    const command = commands.find((command) => command === RestartDynoCommand.COMMAND_ID);
    assert.ok(!!command, 'The RestartDynoCommand command is not registered');
  });

  test('restarts the dyno', async () => {
    fetchStub.onFirstCall().callsFake(async () => {
      return new Response(JSON.stringify({ id: '1234', state: 'up' } as Dyno));
    });

    fetchStub.onSecondCall().callsFake(async () => {
      return new Response(JSON.stringify({ id: '1234', state: 'restarting' } as Dyno));
    });

    await vscode.commands.executeCommand<string>(RestartDynoCommand.COMMAND_ID, dyno);
    assert.ok(!!getSessionStub.exceptions.length);
    assert.ok(setStatusBarMessageStub.calledWith('tester-dyno is restarting...'));
  });

  test('shows appropriate status message when restarting fails', async () => {
    fetchStub.onFirstCall().callsFake(async () => {
      return new Response(JSON.stringify({ state: 'up' }));
    });
    fetchStub.onSecondCall().callsFake(async () => {
      return new Response(JSON.stringify({}), { status: 401 });
    });
    await vscode.commands.executeCommand<string>(RestartDynoCommand.COMMAND_ID, dyno);
    assert.ok(showErrorMessageStub.calledWith(`Could not restart ${dyno.name}.`));
  });
});
