import sinon from 'sinon';
import vscode from 'vscode';
import { ExecuteCommandFromEditor, type CommandOptions } from './execute-command-from-editor';
import { HerokuCommand } from '../heroku-command';
import EventEmitter from 'events';
import * as childProcess from 'node:child_process';
import { Readable, Writable } from 'stream';
import * as assert from 'node:assert';

suite('ExecuteCommandFromEditor', () => {
  let sb: sinon.SinonSandbox;
  let terminalStub: {
    show: sinon.SinonStub;
    sendText: sinon.SinonStub;
    dispose: sinon.SinonStub;
  };
  let commands: string[] = [];

  setup(async () => {
    sb = sinon.createSandbox();
    sb.replaceGetter(vscode.workspace, 'workspaceFolders', () => [
      { index: 0, name: 'workspace', uri: { path: '/test/path' } as vscode.Uri }
    ]);

    sb.replace(vscode.window, 'createTerminal', () => {
      terminalStub = {
        show: sinon.stub(),
        sendText: sinon.stub(),
        dispose: sinon.stub()
      };
      return terminalStub as unknown as vscode.Terminal;
    });

    sb.replace(HerokuCommand, 'exec', ((cmd: string) => {
      commands.push(cmd);
      using cp = new (class extends EventEmitter {
        public stderr = new Readable();
        public stdout = new Readable();
        public stdin = new Writable();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;

      setTimeout(() => cp.emit('exit', 0), 50);
      return cp;
    }) as unknown as typeof HerokuCommand.exec);
  });

  teardown(() => {
    sb.restore();
  });

  suite('executeCommand', () => {
    test('should execute the command with the expected arguments', async () => {
      const options: CommandOptions = {
        assignments: 'APP_NAME="my-app"; GIT_BRANCH="main";',
        hydratedCommand: 'heroku ps:scale web=1:Standard-1X --app $APP_NAME'
      };

      await vscode.commands.executeCommand(ExecuteCommandFromEditor.COMMAND_ID, 'ps:scale', options);
      assert.equal(
        commands[0],
        'APP_NAME="my-app"; GIT_BRANCH="main";heroku ps:scale web=1:Standard-1X --app $APP_NAME'
      );
    });
  });
});
