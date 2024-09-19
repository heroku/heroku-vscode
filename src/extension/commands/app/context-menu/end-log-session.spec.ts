import * as assert from 'node:assert';

import * as vscode from 'vscode';
import { EndLogSession } from './end-log-session';

suite('The EndLogSession command', () => {
  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === EndLogSession.COMMAND_ID);
    assert.ok(command, 'The EndLogSession is not registered.');
  });

  test('successfully deletes the "logSession" property', async () => {
    const app = { logSession: {} };
    await vscode.commands.executeCommand<void>(EndLogSession.COMMAND_ID, app);
    assert.equal(Reflect.has(app, 'logSession'), false, 'The EndLogSession did not complete successfully.');
  });
});
