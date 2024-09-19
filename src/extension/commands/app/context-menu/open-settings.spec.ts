import * as assert from 'node:assert';

import * as vscode from 'vscode';
import Sinon from 'sinon';
import { OpenAppSettings } from './open-settings';

suite('The OpenAppSettings command', () => {
  let openStub: sinon.SinonStub;

  setup(() => {
    openStub = Sinon.stub(vscode.env, 'openExternal');
  });

  teardown(() => {
    openStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === OpenAppSettings.COMMAND_ID);
    assert.ok(command, 'The OpenAppSettings is not registered.');
  });

  test('successfully opens the external URL', async () => {
    const app = { name: 'example-app-321' };
    await vscode.commands.executeCommand<void>(OpenAppSettings.COMMAND_ID, app);
    assert.ok(
      openStub.calledWith(vscode.Uri.parse(`https://dashboard.heroku.com/apps/${app.name}/settings`)),
      'The OpenAppSettings did not received the expected arguments.'
    );
  });
});
