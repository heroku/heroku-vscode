import * as assert from 'node:assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { WelcomeViewSignIn } from './welcome-view-sign-in';

suite('The WelcomViewSignInCommand', () => {
  let getSessionStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;

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
    getSessionStub = sinon.stub(vscode.authentication, 'getSession');
    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
  });

  teardown(() => {
    getSessionStub.restore();
    showErrorMessageStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find(command => command === WelcomeViewSignIn.COMMAND_ID);
    assert.ok(!!command, 'The WelcomeViewSignIn command is not registered');
  });

  test('successfully authenticates', async () => {
    getSessionStub.callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });
    await vscode.commands.executeCommand<string>(WelcomeViewSignIn.COMMAND_ID);
    assert.ok(!!getSessionStub.exceptions.length);
  });

  test('asks the user to try again when authentication fails', async() => {
    showErrorMessageStub.callsFake(async () => 'skip');
    getSessionStub.throws(new Error('failed!'));
    const result = await vscode.commands.executeCommand<string>(WelcomeViewSignIn.COMMAND_ID);
    assert.ok(showErrorMessageStub.called);
  })
});
