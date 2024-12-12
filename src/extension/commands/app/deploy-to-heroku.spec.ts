import * as sinon from 'sinon';
import * as vscode from 'vscode';
import assert from 'node:assert';
import { DeployToHeroku } from './deploy-to-heroku';
import { GitExtension, Repository } from '../../../../@types/git';
import SourceService from '@heroku-cli/schema/services/source-service.js';
import AppSetupService from '@heroku-cli/schema/services/app-setup-service.js';
import AppService from '@heroku-cli/schema/services/app-service.js';
import BuildService from '@heroku-cli/schema/services/build-service.js';
import { App } from '@heroku-cli/schema';
import { Readable, Writable } from 'node:stream';

suite('DeployToHeroku Tests', () => {
  let command: DeployToHeroku;
  let mockWorkspaceFs: { stat: sinon.SinonStub; readFile: sinon.SinonStub };
  let mockWindow: sinon.SinonStubbedInstance<typeof vscode.window>;
  let mockAuthentication: sinon.SinonStubbedInstance<typeof vscode.authentication>;
  let mockCommands: sinon.SinonStubbedInstance<typeof vscode.commands>;
  let mockSourcesService: Pick<SourceService, 'create'> & { create: sinon.SinonStub };
  let mockAppSetupService: Pick<AppSetupService, 'create' | 'info'> & {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
  };
  let mockBuildService: Pick<BuildService, 'create' | 'info'> & {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
  };
  let mockAppService: Pick<AppService, 'info'> & { info: sinon.SinonStub };

  let mockWorkspaceFolder: vscode.WorkspaceFolder;
  let fetchStub: typeof fetch & sinon.SinonStub;
  let stream: Writable;

  setup(() => {
    // Setup mock services
    mockSourcesService = {
      create: sinon.stub()
    };
    mockAppSetupService = {
      create: sinon.stub(),
      info: sinon.stub()
    };
    mockBuildService = {
      create: sinon.stub(),
      info: sinon.stub()
    };
    mockAppService = {
      info: sinon.stub()
    };

    const readable = Readable.from(
      (async function* () {
        yield 'test log output';
      })()
    );

    fetchStub = sinon.stub(globalThis, 'fetch');
    fetchStub
      .withArgs('https://test-put-url.com', {
        signal: sinon.match.any,
        method: 'PUT',
        body: sinon.match.any,
        duplex: 'half',
        headers: {
          'Content-Length': sinon.match.any
        }
      })
      .resolves({ ok: true } as Response);
    fetchStub.withArgs('https://output_stream_url.com', sinon.match.any).resolves(new Response(readable));

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
                addRemote: sinon.stub().resolves(),
                state: { remotes: [] }
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
    Reflect.set(command, 'buildService', mockBuildService);
    Reflect.set(command, 'appService', mockAppService);
    Reflect.set(command, 'sourcesService', mockSourcesService);
  });

  teardown(() => {
    sinon.restore();
  });

  test('run() - successful new app deployment flow', async () => {
    mockWindow.withProgress.callThrough();
    const mockAccessToken = 'test-token';
    const mockAppSetup = {
      build: {
        id: 'test-id',
        app: {
          id: 'test-id',
          name: 'test-app'
        },
        output_stream_url: 'https://output_stream_url.com'
      },
      app: {
        id: 'test-id',
        name: 'test-app'
      }
    };
    const mockAppJson = { name: 'test-app' };

    mockAuthentication.getSession.resolves({ accessToken: mockAccessToken } as vscode.AuthenticationSession);
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.resolves(Buffer.from(JSON.stringify(mockAppJson)));
    mockSourcesService.create.resolves({
      source_blob: {
        put_url: 'https://test-put-url.com',
        get_url: 'test-get-url'
      }
    });
    mockAppSetupService.create.resolves(mockAppSetup);
    mockAppSetupService.info.resolves(mockAppSetup);

    await command.run(null, null);

    assert.ok(mockSourcesService.create.calledOnce);
    assert.ok(mockAppSetupService.create.calledOnce);
    assert.ok(mockAppSetupService.info.calledOnce);
  });

  test('run() - successful existing app deployment flow', async () => {
    mockWindow.withProgress.callThrough();
    const mockAccessToken = 'test-token';
    const mockApp = {
      id: 'test-id',
      name: 'test-app'
    };
    const mockBuild = {
      id: 'test-id',
      status: 'successful',
      app: mockApp
    };

    mockAuthentication.getSession.resolves({ accessToken: mockAccessToken } as vscode.AuthenticationSession);
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.resolves(new Uint8Array([0, 1]));
    mockSourcesService.create.resolves({
      source_blob: {
        put_url: 'https://test-put-url.com',
        get_url: 'test-get-url'
      }
    });
    mockBuildService.create.resolves(mockBuild);
    mockAppService.info.resolves({ git_url: 'test-git-url' });

    await command.run(mockApp as App, null);

    assert.ok(mockSourcesService.create.calledOnce);
    assert.ok(mockBuildService.create.calledOnce);
    assert.ok(mockBuildService.info.calledOnce);
  });

  test('run() - successful quick picked app deployment flow', async () => {
    mockWindow.withProgress.callThrough();
    mockWindow.showQuickPick.resolves('test-app' as unknown as vscode.QuickPickItem);
    const mockAccessToken = 'test-token';
    const mockApp = {
      id: 'test-id',
      name: 'test-app'
    };
    const mockBuild = {
      id: 'test-id',
      status: 'successful',
      app: mockApp
    };
    const validAppJson = {
      name: 'test-app',
      description: 'test description'
    };
    mockAuthentication.getSession.resolves({ accessToken: mockAccessToken } as vscode.AuthenticationSession);
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.onFirstCall().resolves(Buffer.from(JSON.stringify(validAppJson)));
    mockWorkspaceFs.readFile.onSecondCall().resolves(new Uint8Array([0, 1]));
    mockSourcesService.create.resolves({
      source_blob: {
        put_url: 'https://test-put-url.com',
        get_url: 'test-get-url'
      }
    });
    mockBuildService.create.resolves(mockBuild);
    mockAppService.info.resolves({ ...mockApp, git_url: 'test-git-url' });
    mockBuildService.info.resolves(mockBuild);

    await command.run(null, null, { appNames: ['test-id'] });

    assert.ok(mockSourcesService.create.calledOnce);
    assert.ok(mockBuildService.create.calledOnce);
    assert.ok(mockBuildService.info.calledOnce);
  });

  test('validateProcfile() - missing Procfile', async () => {
    mockWorkspaceFs.stat.rejects(new Error('File not found'));

    assert.rejects(command['validateProcfile'](), 'No Procfile found. Deployment cannot continue.');
  });

  test('validateProcfile() - Procfile exists', async () => {
    mockWorkspaceFs.stat.resolves({});

    assert.doesNotReject(command['validateProcfile']());
  });

  test('validateAppJson() - valid app.json', async () => {
    const validAppJson = {
      name: 'test-app',
      description: 'test description'
    };
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.resolves(Buffer.from(JSON.stringify(validAppJson)));
    Reflect.set(command, 'deploymentOptions', { rootUri: mockWorkspaceFolder.uri });
    const result = await command['validateAppJson']();

    assert.deepEqual(result, validAppJson);
  });

  test('validateAppJson() - invalid app.json', async () => {
    const invalidAppJson = {
      name: '2134test-app',
      description: 'test description'
    };
    mockWorkspaceFs.stat.resolves();
    mockWorkspaceFs.readFile.resolves(Buffer.from(JSON.stringify(invalidAppJson)));

    assert.rejects(command['validateAppJson']());
  });

  test('validateAppJson() - app.json missing', async () => {
    mockWorkspaceFs.stat.rejects();

    assert.rejects(command['validateAppJson']());
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
