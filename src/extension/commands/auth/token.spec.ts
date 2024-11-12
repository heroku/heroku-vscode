import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';

import * as vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { EventEmitter } from 'node:stream';
import { TokenCommand } from './token';

suite('The TokenCommand', () => {
  let execStub: sinon.SinonStub;

  setup(() => {
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();

        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.stdout?.emit('data', 'abc-123'));
      setTimeout(() => cp.emit('exit', 0), 50);
      return cp;
    });
  });

  teardown(() => {
    execStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === TokenCommand.COMMAND_ID);
    assert.ok(!!command, 'The TokenCommand is not registered');
  });

  test('successfully returns the auth token', async () => {
    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, 'abc-123', `Output was ${result} but expected abc-123`);
  });
});
