import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { LoginCommand } from './login';
import { HerokuCommand } from '../heroku-command';
import { setup, teardown } from 'mocha';
import { EventEmitter } from 'node:stream';

suite('The LoginCommand', () => {
  let execStub: sinon.SinonStub;

  setup(() => {
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      using cp = new (class extends EventEmitter {
        public stderr = new EventEmitter();
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;

      setTimeout(() => cp.stderr?.emit('data', 'Press any key to open up the browser to login or q to exit:'));
      setTimeout(() => cp.stdout?.emit('data', 'Logged in as'));
      setTimeout(() => cp.emit('exit', 0));
      return cp;
    });
  });

  teardown(() => {
    execStub.restore();
  });

  test('is registered', async () => {
    const allCommands = (await vscode.commands.getCommands()).filter((cmd) => cmd.includes('git'));
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === LoginCommand.COMMAND_ID);
    assert.ok(!!command, 'The LoginCommand is not registered.');
  });

  test('authenticates successfully using the happy path', async () => {
    const result = await vscode.commands.executeCommand<{ exitCode: number }>(LoginCommand.COMMAND_ID);
    assert.equal(result?.exitCode, 0, 'The LoginCommand did not complete successfully.');
  });
});
