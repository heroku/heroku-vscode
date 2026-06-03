import * as assert from 'node:assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { Formation } from '@heroku-cli/schema';
import { ScaleFormationCommand } from './scale-formation';
import * as herokuSdkUtil from '../../utils/heroku-sdk';

suite('The ScaleFormationCommand', () => {
  let getSessionStub: sinon.SinonStub;

  let showErrorMessageStub: sinon.SinonStub;
  let setStatusBarMessageStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let dynoScaleStub: sinon.SinonStub;

  const formation = {
    id: randomUUID(),
    size: 'Standard-X1',
    quantity: 1,
    type: 'web',
    app: {
      id: 'app-id',
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
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').callsFake(async () => '5');

    getSessionStub = sinon.stub(vscode.authentication, 'getSession').callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });

    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');

    setStatusBarMessageStub = sinon.stub(vscode.window, 'setStatusBarMessage');

    dynoScaleStub = sinon.stub();
    sinon.stub(herokuSdkUtil, 'createHerokuSDK').resolves({
      platform: {
        dyno: {
          scale: dynoScaleStub
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
    const command = commands.find((command) => command === ScaleFormationCommand.COMMAND_ID);
    assert.ok(!!command, 'The ScaleFormationCommand command is not registered');
  });

  test('scales the formation', async () => {
    dynoScaleStub.resolves({ id: '1234', quantity: 5 } as Formation);

    await vscode.commands.executeCommand<string>(ScaleFormationCommand.COMMAND_ID, formation);
    assert.equal(formation.quantity, 5);
    assert.ok(dynoScaleStub.calledOnce, 'dyno.scale was not called once');
    const [appId, update] = dynoScaleStub.firstCall.args;
    assert.equal(appId, formation.app.id);
    assert.deepEqual(update, { type: formation.type, quantity: 5 });
  });

  test('shows appropriate status message when scaling fails', async () => {
    dynoScaleStub.rejects(new Error('Unauthorized'));

    await vscode.commands.executeCommand<string>(ScaleFormationCommand.COMMAND_ID, formation);
    assert.ok(showErrorMessageStub.calledWith(`Could not scale the formation for the ${formation.app.name} app.`));
  });
});
