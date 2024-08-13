import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';

import * as vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { EventEmitter } from 'node:stream';
import { WhoAmI } from './whoami';

suite('The WhoamiCommand', () => {
  let execStub: sinon.SinonStub;

  setup(() => {
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();

        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.stdout?.emit('data', 'tester-321@heroku.com'));
      setTimeout(() => cp.emit('exit', 0));
      return cp;
    });
  });

  teardown(() => {
    execStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const tokenCommand = commands.find((command) => command === WhoAmI.COMMAND_ID);
    assert.ok(!!tokenCommand, 'The WhoamI command is not registered');
  });

  test('successfully returns the user', async () => {
    const result = await vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID);
    assert.equal(result, 'tester-321@heroku.com', `Output was ${result} but expected abc-123`);
  });
});
