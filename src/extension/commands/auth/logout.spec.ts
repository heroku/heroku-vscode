import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';

import * as vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { LogoutCommand } from './logout';
import { EventEmitter } from 'node:stream';

suite('The LogoutCommand', () => {
  let execStub: sinon.SinonStub;

  setup(() => {
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      const cp = new (class extends EventEmitter {
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.emit('exit', 0), 50);
      return cp;
    });
  });

  teardown(() => {
    execStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === LogoutCommand.COMMAND_ID);
    assert.ok(command, 'The LogoutCommand is not registered.');
  });

  test('logs out successfully using the happy path', async () => {
    const result = await vscode.commands.executeCommand<{ exitCode: number }>(LogoutCommand.COMMAND_ID);
    assert.equal(result?.exitCode, 0, 'The LogoutCommand did not complete successfully.');
  });
});
