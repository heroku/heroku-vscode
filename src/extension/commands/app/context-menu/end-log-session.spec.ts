import * as assert from 'node:assert';

import * as vscode from 'vscode';
import { EndLogSession } from './end-log-session';

suite('The EndLogSession command', () => {
  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === EndLogSession.COMMAND_ID);
    assert.ok(command, 'The EndLogSession is not registered.');
  });

  test('successfully mutes the log session', async () => {
    const app = { logSession: { muted: false } };
    await vscode.commands.executeCommand<void>(EndLogSession.COMMAND_ID, app);
    assert.equal(Reflect.get(app.logSession, 'muted'), true, 'The EndLogSession did not complete successfully.');
  });
});
