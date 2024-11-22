import * as sinon from 'sinon';
import * as vscode from 'vscode';
import assert from 'node:assert';
import { DeployToHeroku } from './deploy-to-heroku';
import { Branch, GitExtension, Repository } from '../../git';
import SourceService from '@heroku-cli/schema/services/source-service.js';
import AppSetupService from '@heroku-cli/schema/services/app-setup-service.js';
import AppService from '@heroku-cli/schema/services/app-service.js';
import { SourceBlob } from '@heroku-cli/schema';

suite('DeployToHeroku Tests', () => {
  let command: DeployToHeroku;
  let mockWorkspaceFs: { stat: sinon.SinonStub; readFile: sinon.SinonStub };
  let mockWindow: sinon.SinonStubbedInstance<typeof vscode.window>;
  let mockAuthentication: sinon.SinonStubbedInstance<typeof vscode.authentication>;
  let mockCommands: sinon.SinonStubbedInstance<typeof vscode.commands>;
  let mockSourcesService: Pick<SourceService, 'create'> & { create: sinon.SinonStub };
  let mockAppSetupService: Pick<AppSetupService, 'create'> & { create: sinon.SinonStub };
  let mockAppService: Pick<AppService, 'info'> & { info: sinon.SinonStub };
  let mockWorkspaceFolder: vscode.WorkspaceFolder;
  let fetchStub: typeof fetch & sinon.SinonStub;

  setup(() => {
    // Setup mock services
    mockSourcesService = {
      create: sinon.stub()
    };
    mockAppSetupService = {
      create: sinon.stub()
    };
    mockAppService = {
      info: sinon.stub()
    };
    fetchStub = sinon.stub(globalThis, 'fetch');
    fetchStub
      .withArgs('test-put-url', {
        method: 'PUT',
        body: sinon.match.any
      })
      .resolves({ ok: true } as Response);

    // Setup VSCode mocks
    mockWindow = sinon.stub(vscode.window);
    mockAuthentication = sinon.stub(vscode.authentication);
    mockCommands = sinon.stub(vscode.commands);
    mockWorkspaceFs = {
      stat: sinon.stub(),
      readFile: sinon.stub()
    };

    const mockUri = vscode.Uri.file('/workspace/app.json');

    mockWorkspaceFolder = {
      uri: mockUri,
      name: 'test-workspace',
      index: 0
    };

    sinon.replace(vscode.extensions, 'getExtension', (): any => {
      return {
        isActive: true,
        exports: {
          getAPI: () => ({
            repositories: [
              {
                rootUri: vscode.Uri.file('/workspace/app.json'),
                checkIgnore: () => new Set(),
                addRemote: sinon.stub().resolves()
              } as unknown as Repository
            ]
          })
        } as unknown as GitExtension
      } as vscode.Extension<GitExtension>;
    });

    sinon.replaceGetter(vscode.workspace, 'fs', () => mockWorkspaceFs as unknown as typeof vscode.workspace.fs);
    sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [mockWorkspaceFolder]);
    command = new DeployToHeroku();
    Reflect.set(command, 'appSetupService', mockAppSetupService);
    Reflect.set(command, 'appService', mockAppService);
    Reflect.set(command, 'sourcesService', mockSourcesService);
  });

  teardown(() => {
    sinon.restore();
  });

  test('run() - successful deployment flow', async () => {
    mockWindow.withProgress.callThrough();
    const mockAccessToken = 'test-token';
    const mockAppJson = { name: 'test-app' };
    const mockAppSetup = {
      app: {
        id: 'test-id',
        name: 'test-app'
      }
    };

    mockAuthentication.getSession.resolves({ accessToken: mockAccessToken } as vscode.AuthenticationSession);
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.resolves(Buffer.from(JSON.stringify(mockAppJson)));
    mockSourcesService.create.resolves({
      source_blob: {
        put_url: 'test-put-url',
        get_url: 'test-get-url'
      }
    });
    mockAppSetupService.create.resolves(mockAppSetup);
    mockAppService.info.resolves({ git_url: 'test-git-url' });

    await command.run();

    assert.ok(mockSourcesService.create.calledOnce);
    assert.ok(mockAppSetupService.create.calledOnce);
    assert.ok(mockAppService.info.calledOnce);
  });

  test('validateWorkspace() - missing app.json', async () => {
    mockWorkspaceFs.stat.rejects(new Error('File not found'));

    const result = await command['validateWorkspace']();

    assert.ok(!result);
    assert.equal(mockWindow.showErrorMessage.args[0][0], 'No app.json file found. Deployment cannot continue');
    assert.equal(mockWindow.showErrorMessage.args[0][1], 'OK');
  });

  test('validateAndReturnAppJson() - valid app.json', async () => {
    const validAppJson = {
      name: 'test-app',
      description: 'test description'
    };
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.resolves(Buffer.from(JSON.stringify(validAppJson)));

    const result = await command['validateAndReturnAppJson']();

    assert.deepEqual(result, validAppJson);
  });

  test('deployToHeroku() - successful deployment', async () => {
    const mockSourceBlob = {
      put_url: 'test-put-url',
      get_url: 'test-get-url'
    };
    const mockAppSetup = {
      app: {
        id: 'test-id',
        name: 'test-app'
      }
    };

    mockSourcesService.create.resolves({ source_blob: mockSourceBlob });
    global.fetch = sinon.stub().resolves({ ok: true });
    mockAppSetupService.create.resolves(mockAppSetup);
    mockAppService.info.resolves({ git_url: 'test-git-url' });

    const result = await command['deployToHeroku']();

    assert.deepEqual(result, mockAppSetup);
    assert.ok(mockSourcesService.create.calledOnce);
    assert.ok(mockAppSetupService.create.calledOnce);
  });

  test('askToContinueWithDirtyBranch() - user confirms', async () => {
    mockWindow.showWarningMessage.resolves('Yes' as unknown as vscode.MessageItem);
    const branch = { name: 'main' } as Branch;
    const appJsonChanged = true;

    const result = await command['askToContinueWithDirtyBranch'](branch, appJsonChanged);

    assert.ok(result);
    assert.ok(mockWindow.showWarningMessage.calledOnce);
  });

  test('deployToHeroku() - upload failure', async () => {
    const mockSourceBlob = {
      put_url: 'test-put-url',
      get_url: 'test-get-url'
    };
    mockSourcesService.create.resolves({ source_blob: mockSourceBlob });
    global.fetch = sinon.stub().resolves({ ok: false });

    await assert.rejects(command['deployToHeroku']());
  });
});
