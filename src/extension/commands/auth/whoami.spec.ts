import * as assert from 'node:assert';
import sinon from 'sinon';
import * as childProcess from 'node:child_process';

import * as vscode from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { EventEmitter } from 'node:stream';
import { WhoAmI } from './whoami';
import { randomUUID } from 'node:crypto';
import { TokenCommand } from './token';
import { Account } from '@heroku-cli/schema';

suite('The WhoamiCommand', () => {
  let fetchStub: sinon.SinonStub;
  let getSessionStub: sinon.SinonStub;
  let vsCodeExecCommandStub: sinon.SinonStub;

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
    fetchStub = sinon.stub(globalThis, 'fetch');
    getSessionStub = sinon.stub(vscode.authentication, 'getSession').callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });
    vsCodeExecCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    vsCodeExecCommandStub.withArgs(TokenCommand.COMMAND_ID, sinon.match.any).resolves(randomUUID());

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
    fetchStub.onFirstCall().callsFake(async () => {
      return new Response(JSON.stringify(account));
    });
    const result = await vscode.commands.executeCommand<string>(WhoAmI.COMMAND_ID);
    assert.equal(result, 'tester-321@heroku.com', `Output was ${result} but expected abc-123`);
  });
});
