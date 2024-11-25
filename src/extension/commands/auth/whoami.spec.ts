import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';
import * as vscode from 'vscode';
import { WhoAmI, type WhoAmIResult } from './whoami';
import { randomUUID } from 'node:crypto';
import { TokenCommand } from './token';
import type { Account } from '@heroku-cli/schema';
import { HerokuCommand } from '../heroku-command';
import { EventEmitter } from 'node:stream';

suite('The WhoamiCommand', () => {
  let fetchStub: sinon.SinonStub;
  let getSessionStub: sinon.SinonStub;
  let vsCodeExecCommandStub: sinon.SinonStub;
  let execStub: sinon.SinonStub;

  const sessionObject = {
    account: {
      id: 'Heroku',
      label: 'tester-123@heroku.com'
    },
    id: randomUUID(),
    scopes: [],
    accessToken: randomUUID()
  };

  setup(() => {
    WhoAmI.account = undefined;
    fetchStub = sinon.stub(globalThis, 'fetch');
    getSessionStub = sinon.stub(vscode.authentication, 'getSession').callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });
    execStub = sinon.stub(HerokuCommand, 'exec').callsFake(() => {
      const cp = new (class extends EventEmitter {
        public stdout = new EventEmitter();

        public [Symbol.dispose]() {}
      })() as childProcess.ChildProcess;
      setTimeout(() => cp.stdout?.emit('data', sessionObject.accessToken));
      setTimeout(() => cp.emit('exit', 0), 50);
      return cp;
    });
    vsCodeExecCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    vsCodeExecCommandStub.withArgs(TokenCommand.COMMAND_ID, sinon.match.any).resolves(sessionObject.accessToken);

    vsCodeExecCommandStub.callThrough();
  });

  teardown(() => {
    sinon.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === WhoAmI.COMMAND_ID);
    assert.ok(!!command, 'The WhoamI command is not registered');
  });

  test('successfully returns the user', async () => {
    let account = {
      id: randomUUID(),
      email: 'tester-321@heroku.com'
    } as Account;
    fetchStub.withArgs('https://api.heroku.com/account').resolves(new Response(JSON.stringify(account)));
    const result = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);
    assert.deepStrictEqual(account, result.account);
    assert.deepStrictEqual(result.token, sessionObject.accessToken);
  });
});
