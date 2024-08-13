import * as assert from 'node:assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { RestartDynoCommand } from './restart-dyno';
import { Dyno, Formation } from '@heroku-cli/schema';
import { ScaleFormationCommand } from './scale-formation';

suite('The ScaleFormationCommand', () => {
  let getSessionStub: sinon.SinonStub;

  let showErrorMessageStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;
  let setStatusBarMessageStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;

  const formation = {
    id: randomUUID(),
    size: 'Standard-X1',
    quantity: 1,
    app: {
      name: 'test-app'
    }
  } as Formation;

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
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox')
    .callsFake(async () => '5');

    getSessionStub = sinon.stub(vscode.authentication, 'getSession')
      .callsFake(async (providerId: string) => {
        if (providerId === 'heroku:auth:login') {
          return sessionObject;
        }
        return undefined;
      });

    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');

    fetchStub = sinon.stub(globalThis, 'fetch');
    setStatusBarMessageStub = sinon.stub(vscode.window, 'setStatusBarMessage');
  });

  teardown(() => {
    getSessionStub.restore();
    fetchStub.restore();
    setStatusBarMessageStub.restore();
    showErrorMessageStub.restore();
    showInputBoxStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find(command => command === ScaleFormationCommand.COMMAND_ID);
    assert.ok(!!command, 'The ScaleFormationCommand command is not registered');
  });

  test('scales the formation', async () => {
    fetchStub.onFirstCall().callsFake(async () => {
      return new Response(JSON.stringify({ id: '1234', quantity: 5 } as Formation));
    });

    await vscode.commands.executeCommand<string>(ScaleFormationCommand.COMMAND_ID, formation);
    assert.ok(!!getSessionStub.exceptions.length);
    assert.equal(formation.quantity, 5);
  });

  test('shows appropriate status message when restarting fails', async () => {
    fetchStub.onFirstCall().callsFake(async () => {
      return new Response(JSON.stringify({}), { status: 401 });
    });
    await vscode.commands.executeCommand<string>(ScaleFormationCommand.COMMAND_ID, formation);
    assert.ok(showErrorMessageStub.calledWith(`Could not scale the formation for the ${formation.app.name} app.`));
  });
});
