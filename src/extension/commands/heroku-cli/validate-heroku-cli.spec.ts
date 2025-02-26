import * as assert from 'node:assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { ValidateHerokuCLICommand } from './validate-heroku-cli';
import { HerokuCommand } from '../heroku-command';
import EventEmitter from 'node:events';
import * as childProcess from 'node:child_process';

suite('The ValidateHerokuCLICommand', () => {
  let execStub: sinon.SinonStub;
  let showWarningMessageStub: sinon.SinonStub;
  let openExternalStub: sinon.SinonStub;
  let exitCode = 0;
  setup(() => {
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as unknown as childProcess.ChildProcess;
      setTimeout(() => cp.stdout?.emit('data', 'heroku version 10.0.0'));
      setTimeout(() => cp.emit('exit', exitCode), 50);
      return cp;
    });
    showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
    openExternalStub = sinon.stub(vscode.env, 'openExternal');
  });

  teardown(() => {
    execStub.restore();
    showWarningMessageStub.restore();
    openExternalStub.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === ValidateHerokuCLICommand.COMMAND_ID);
    assert.ok(!!command, 'The ValidateHerokuCLICommand is not registered');
  });

  test('returns true when Heroku CLI is installed', async () => {
    const result = await vscode.commands.executeCommand<boolean>(ValidateHerokuCLICommand.COMMAND_ID);
    assert.strictEqual(result, true);
    assert.ok(execStub.calledWith('heroku --version'));
    assert.ok(!showWarningMessageStub.called);
  });

  test('shows warning and returns false when Heroku CLI is not installed', async () => {
    exitCode = 1;
    showWarningMessageStub.resolves('Cancel');

    const result = await vscode.commands.executeCommand<boolean>(ValidateHerokuCLICommand.COMMAND_ID);
    assert.strictEqual(result, false);
    assert.ok(
      showWarningMessageStub.calledWith(
        'The Heroku CLI is required to use this extension.',
        'Cancel',
        'Install Heroku CLI'
      )
    );
  });

  test('opens browser when user chooses to install Heroku CLI', async () => {
    exitCode = 1;
    showWarningMessageStub.resolves('Install Heroku CLI');
    openExternalStub.resolves(true);

    const result = await vscode.commands.executeCommand<boolean>(ValidateHerokuCLICommand.COMMAND_ID);
    assert.strictEqual(result, false);
    assert.ok(openExternalStub.calledWith(vscode.Uri.parse('https://devcenter.heroku.com/articles/heroku-cli')));
  });

  test('returns false when CLI check throws an error', async () => {
    exitCode = 1;
    showWarningMessageStub.resolves('Cancel');

    const result = await vscode.commands.executeCommand<boolean>(ValidateHerokuCLICommand.COMMAND_ID);
    assert.strictEqual(result, false);
    assert.ok(showWarningMessageStub.called);
  });
});
