import * as assert from 'node:assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { RestartDynoCommand } from './restart-dyno';
import { Dyno } from '@heroku-cli/schema';
import * as herokuSdkUtil from '../../utils/heroku-sdk';

suite('The RestartDynoCommand', () => {
  let getSessionStub: sinon.SinonStub;
  let showWarningMessageStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;
  let setStatusBarMessageStub: sinon.SinonStub;
  let dynoRestartStub: sinon.SinonStub;

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

    setStatusBarMessageStub = sinon.stub(vscode.window, 'setStatusBarMessage');

    dynoRestartStub = sinon.stub();
    sinon.stub(herokuSdkUtil, 'createHerokuSDK').resolves({
      platform: {
        dyno: {
          restart: dynoRestartStub
        }
      },
      data: {}
    } as never);
  });

  teardown(() => {
    sinon.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === RestartDynoCommand.COMMAND_ID);
    assert.ok(!!command, 'The RestartDynoCommand command is not registered');
  });

  test('restarts the dyno', async () => {
    dynoRestartStub.resolves({ id: '1234', state: 'restarting' } as Dyno);

    await vscode.commands.executeCommand<string>(RestartDynoCommand.COMMAND_ID, dyno);
    assert.ok(setStatusBarMessageStub.calledWith('tester-dyno is restarting...'));
    assert.ok(dynoRestartStub.calledOnceWith('1234', { dyno: 'tester-dyno' }));
  });

  test('shows appropriate status message when restarting fails', async () => {
    dynoRestartStub.rejects(new Error('Unauthorized'));

    await vscode.commands.executeCommand<string>(RestartDynoCommand.COMMAND_ID, dyno);
    assert.ok(showErrorMessageStub.calledWith(`Could not restart ${dyno.name}.`));
  });
});
