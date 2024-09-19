import * as assert from 'node:assert';

import * as vscode from 'vscode';
import { OpenApp } from './open-app';
import Sinon from 'sinon';

suite('The OpenApp command', () => {
  let openStub: sinon.SinonStub;

  setup(() => {
    openStub = Sinon.stub(vscode.env, 'openExternal');
  });

  teardown(() => {
    openStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === OpenApp.COMMAND_ID);
    assert.ok(command, 'The OpenAppCommand is not registered.');
  });

  test('successfully opens the external URL', async () => {
    const app = { web_url: 'https://example.com' };
    await vscode.commands.executeCommand<void>(OpenApp.COMMAND_ID, app);
    assert.ok(
      openStub.calledWith(vscode.Uri.parse(app.web_url)),
      'The OpenAppCommand did not received the expected arguments.'
    );
  });
});
