import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';
import * as vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { EventEmitter } from 'node:stream';
import { TokenCommand } from './token';
import * as netrcLocator from '../../utils/netrc-locator';

suite('The TokenCommand', () => {
  let execStub: sinon.SinonStub;
  let netRcLocatorStub: sinon.SinonStub;
  let netrcContent = 'machine api.heroku.com\n  login user@example.com\n  password def-456\n';
  setup(() => {
    // Stub file system operations
    sinon.stub(vscode.workspace, 'fs').value({
      readFile: async () => Buffer.from(netrcContent),
      writeFile: async () => {},
      delete: async () => {}
    } as unknown as vscode.FileSystem);

    netRcLocatorStub = sinon.stub(netrcLocator, 'getNetrcFileLocation').resolves('netrc-file');

    // Stub child process for GPG
    execStub = sinon.stub(HerokuCommand, 'exec');
    execStub.callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;

      setTimeout(() => cp.stdout?.emit('data', netrcContent));
      setTimeout(() => cp.emit('exit', 0), 50);
      return cp;
    });
  });

  teardown(() => {
    sinon.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === TokenCommand.COMMAND_ID);
    assert.ok(!!command, 'The TokenCommand is not registered');
  });

  test('successfully reads token from unencrypted .netrc', async () => {
    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, 'def-456');
  });

  test('successfully reads token from encrypted .netrc.gpg', async () => {
    // Simulate GPG decryption
    netRcLocatorStub.resolves('netrc-file.gpg');

    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, 'def-456');
  });

  test('returns null when no .netrc or .netrc.gpg found', async () => {
    netRcLocatorStub.resolves(null);
    netrcContent = '';
    execStub.callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.emit('exit', 1), 50);
      return cp;
    });

    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, null);
  });

  test('returns null when no Heroku machine entry found', async () => {
    netrcContent = 'machine api.github.com\n  login user\n  password token123';

    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, null);
  });

  test('handles malformed .netrc content', async () => {
    netrcContent = 'invalid content\nno machine entries';

    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, null);
  });

  test('handles GPG decryption errors', async () => {
    execStub.callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.emit('error', new Error('GPG error')), 50);
      return cp;
    });

    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, null);
  });

  test('handles GPG non-zero exit codes', async () => {
    execStub.callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();
        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.emit('exit', 1), 50);
      return cp;
    });

    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, null);
  });

  test('handles non-encrypted alternate whitespace formats', async () => {
    netrcContent = `
    machine api.heroku.com
  login tester@heroku.com
  password abc-123
machine git.heroku.com
  login tester@heroku.com
  password abc-123`;
    const result = await vscode.commands.executeCommand<string>(TokenCommand.COMMAND_ID);
    assert.equal(result, 'abc-123');
  });
});
