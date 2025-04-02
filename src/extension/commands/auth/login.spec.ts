import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { AuthCompletionInfo, LoginCommand } from './login';
import { HerokuCommand } from '../heroku-command';
import { setup, teardown } from 'mocha';
import { EventEmitter } from 'node:stream';
import { WhoAmI } from './whoami';

suite('The LoginCommand', () => {
  let execStub: sinon.SinonStub;
  let createTerminalStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let vsCodeExecCommandStub: sinon.SinonStub;
  let mockTerminal: { show: sinon.SinonStub; sendText: sinon.SinonStub; dispose: sinon.SinonStub };
  const logFile = vscode.Uri.file('auth-result.log');

  setup(() => {
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      using cp = new (class extends EventEmitter {
        public stderr = new EventEmitter();
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;

      setTimeout(() => cp.stderr?.emit('data', 'Press any key to open up the browser to login or q to exit:'), 50);
      setTimeout(() => cp.stdout?.emit('data', 'Logged in as'), 50);
      setTimeout(() => cp.emit('exit', 0), 50);
      return cp;
    });

    mockTerminal = {
      show: sinon.stub(),
      sendText: sinon.stub(),
      dispose: sinon.stub()
    };

    sinon.stub(vscode.workspace, 'createFileSystemWatcher').returns({
      onDidChange: (cb: CallableFunction) => {
        cb();
        return { dispose: async () => void 0 };
      },
      onDidCreate: () => {},
      onDidDelete: () => {},
      dispose: () => {}
    } as unknown as vscode.FileSystemWatcher);

    sinon.stub(vscode.workspace, 'fs').value({
      readFile: async () => Buffer.from('Logged in as tester123@heroku.com'),
      writeFile: async () => {},
      delete: async () => {}
    } as unknown as vscode.FileSystem);

    sinon.stub(vscode.Uri, 'file').returns(logFile);

    createTerminalStub = sinon
      .stub(vscode.window, 'createTerminal')
      .returns(mockTerminal as unknown as vscode.Terminal);

    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').callsFake(async () => 'HKRU-123-abc');

    vsCodeExecCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    vsCodeExecCommandStub
      .withArgs(WhoAmI.COMMAND_ID, false, 'HKRU-123-abc')
      .resolves({ account: { email: 'tester123@heroku.com' } });
    vsCodeExecCommandStub.callThrough();
  });

  teardown(() => {
    sinon.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === LoginCommand.COMMAND_ID);
    assert.ok(!!command, 'The LoginCommand is not registered.');
  });

  test('authenticates successfully using the happy path', async () => {
    const result = await vscode.commands.executeCommand<{ exitCode: number }>(LoginCommand.COMMAND_ID);
    assert.equal(result?.exitCode, 0, 'The LoginCommand did not complete successfully.');
  });

  test('Delegates auth to a manual API key input when the extension is running in a container', async () => {
    // Mock the environment to simulate running in a container
    const originalEnv = process.env;
    process.env.REMOTE_CONTAINERS = 'true';

    try {
      const result = await vscode.commands.executeCommand<AuthCompletionInfo>(LoginCommand.COMMAND_ID);

      // Verify the terminal was created and used correctly
      assert.ok(showInputBoxStub.calledOnce, 'API key input should be shown');

      // Verify the returned result
      assert.deepStrictEqual(
        result,
        {
          authType: 'terminal',
          errorMessage: '',
          exitCode: 0,
          output: 'Logged in as tester123@heroku.com'
        },
        'Should return correct completion info for terminal auth'
      );
    } finally {
      // Cleanup
      process.env = originalEnv;
    }
  });
});
