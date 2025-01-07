import * as assert from 'node:assert';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import * as vscode from 'vscode';
import { App, Dyno, Formation, AddOn } from '@heroku-cli/schema';
import { randomUUID } from 'node:crypto';
import * as gitUtils from '../../utils/git-utils';
import { Readable, Writable } from 'node:stream';
import type { HerokuResourceExplorerProvider } from './heroku-resource-explorer-provider';
import { GitExtension, Repository } from '../../../../@types/git';

suite('HerokuResourceExplorerProvider', () => {
  let provider: HerokuResourceExplorerProvider;
  let mockContext: vscode.ExtensionContext;
  let getSessionStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;
  let elementTypeMap: Map<unknown, unknown>;
  let childParentMap: Map<unknown, unknown>;
  let stream: Writable;

  const mockApp = { id: 'app1', name: 'test-app', organization: { name: 'test-org' } } as App;
  const mockDyno = { type: 'web', name: 'web.1', state: 'up' } as Dyno;
  const mockFormation = { type: 'web', quantity: 1, size: 'Standard-1X' } as Formation;
  const mockAddOn = {
    id: 'addon1',
    name: 'test-addon',
    addon_service: { name: 'test-service', id: 'test-service' }
  } as AddOn;
  const mockElementsAddon = { icon_url: 'https://test-icon-url.com' };
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
    mockContext = {
      subscriptions: [],
      asAbsolutePath(p: string) {
        return p;
      }
    } as any;

    getSessionStub = sinon
      .stub(vscode.authentication, 'getSession')
      .withArgs('heroku:auth:login')
      .resolves(sessionObject);

    // LogStream stub
    stream = new Writable();
    const readable = Readable.from(
      (async function* () {
        let ct = 2;
        while (ct--) {
          const line = await new Promise((resolve) => {
            stream.once('data', (chunk) => {
              resolve(chunk);
            });
          });
          yield line;
        }
      })()
    );

    fetchStub = sinon.stub(global, 'fetch');
    fetchStub.withArgs('https://api.heroku.com/apps/test-app').resolves(new Response(JSON.stringify(mockApp)));
    fetchStub.withArgs('https://api.heroku.com/apps/app1').resolves(new Response(JSON.stringify(mockApp)));
    fetchStub.withArgs('https://api.heroku.com/apps/app1/dynos').resolves(new Response(JSON.stringify([mockDyno])));
    fetchStub.withArgs('https://api.heroku.com/apps/app1/addons').resolves(new Response(JSON.stringify([mockAddOn])));
    fetchStub.withArgs('https://fake.logplex.com').resolves(new Response(readable));

    fetchStub
      .withArgs('https://api.heroku.com/apps/app1/formation')
      .resolves(new Response(JSON.stringify([mockFormation])));

    fetchStub
      .withArgs('https://addons.heroku.com/api/v2/addons/test-service')
      .resolves(new Response(JSON.stringify(mockElementsAddon)));

    fetchStub
      .withArgs('https://api.heroku.com/apps/app1/log-sessions')
      .resolves(new Response(JSON.stringify({ logplex_url: 'https://fake.logplex.com' })));

    fetchStub
      .withArgs('https://api.heroku.com/apps/app1/dynos/web.2')
      .resolves(new Response(JSON.stringify({ ...mockDyno, name: 'web.2', id: randomUUID() })));

    sinon.stub(gitUtils, 'getHerokuAppNames').resolves(['app1']);
    sinon.stub(vscode.commands, 'registerCommand');

    const HerokuResourceExplorerProviderCtor = proxyquire('./heroku-resource-explorer-provider', {
      getHerokuAppNames: () => Promise.resolve(['app1'])
    }).HerokuResourceExplorerProvider;

    provider = new HerokuResourceExplorerProviderCtor(mockContext);

    elementTypeMap = Reflect.get(provider, 'elementTypeMap') as Map<unknown, unknown>;
    childParentMap = Reflect.get(provider, 'childParentMap') as Map<unknown, unknown>;
    const mockWorkspaceFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file('/test/path')
    } as vscode.WorkspaceFolder;
    sinon.replace(vscode.extensions, 'getExtension', (): any => {
      return {
        isActive: true,
        exports: {
          getAPI: () => ({
            repositories: [
              {
                rootUri: vscode.Uri.file('/test/path'),
                state: {
                  onDidChange: () => ({ dispose() {} }),
                  remotes: [
                    {
                      name: 'heroku',
                      pushUrl: 'https://git.heroku.com/app1.git',
                      isReadOnly: false
                    }
                  ]
                }
              } as unknown as Repository
            ]
          })
        } as unknown as GitExtension
      } as vscode.Extension<GitExtension>;
    });
    sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [mockWorkspaceFolder]);
  });

  teardown(() => {
    sinon.restore();
  });

  test('getChildren should return apps when no element is provided', async () => {
    await provider.getChildren(); // <-- first call initializes the git config watcher
    await new Promise((resolve) => provider.event(resolve));
    const children = await provider.getChildren();
    Reflect.deleteProperty(children[0], 'logSession');
    assert.strictEqual(children.length, 1);
    assert.deepStrictEqual(children[0], mockApp);
  });

  test('getChildren should return app categories when an app is provided', async () => {
    await provider.getChildren();
    await new Promise((resolve) => provider.event(resolve));
    const [app] = await provider.getChildren(); // Populate appToResourceMap
    const children = (await provider.getChildren(app)) as vscode.TreeItem[];
    assert.strictEqual(children.length, 3);
    assert.deepStrictEqual(
      children.map((c) => c.label),
      ['FORMATIONS', 'DYNOS', 'ADD-ONS']
    );
  });

  test('getChildren should return formations when FORMATIONS category is provided', async () => {
    await provider.getChildren();
    await new Promise((resolve) => provider.event(resolve));
    const [app] = await provider.getChildren(); // Populate appToResourceMap
    const categories = (await provider.getChildren(app)) as vscode.TreeItem[];
    const formationsCategory = categories.find((c) => c.label === 'FORMATIONS');
    const children = await provider.getChildren(formationsCategory);
    assert.strictEqual(children.length, 1);
    assert.deepStrictEqual(children[0], mockFormation);
  });

  test('getTreeItem should return an AddOn tree item', async () => {
    elementTypeMap.set(mockAddOn, 'AddOn');
    const treeItem = await provider.getTreeItem(mockAddOn);
    assert.strictEqual(treeItem.label, 'test-service');
  });

  test('getTreeItem should return an App tree item', async () => {
    elementTypeMap.set(mockApp, 'App');
    const treeItem = await provider.getTreeItem(mockApp);
    assert.strictEqual(treeItem.label, 'test-app');
    assert.strictEqual(treeItem.contextValue, 'heroku:app');
  });

  test('getParent should return the parent of an element', () => {
    childParentMap.set(mockDyno, mockApp);
    assert.strictEqual(provider.getParent(mockDyno), mockApp);
  });

  test('onFormationScaledTo should update formation quantity and fire event', async () => {
    await provider.getChildren();
    await new Promise((resolve) => provider.event(resolve));
    const [app] = await provider.getChildren(); // Populate appToResourceMap
    const categories = (await provider.getChildren(app)) as vscode.TreeItem[]; // gets the categories

    const formationsCategory = categories.find((c) => c.label === 'FORMATIONS');
    const formation = (await provider.getChildren(formationsCategory))[0] as Formation;

    const fireStub = sinon.stub(provider, 'fire');
    await new Promise((resolve) => setTimeout(resolve, 1100)); // wait for the stream to get setup
    stream.emit('data', 'app[api]: Scaled to web@2:Standard-1X\n');
    await new Promise((resolve) => setTimeout(resolve, 0)); // wait for promisified emit to complete

    assert.strictEqual(formation.quantity, 2);
    assert.ok(fireStub.calledWith(formation));
  });

  test('onDynoStateChanged should update dyno state and fire event', async () => {
    await provider.getChildren();
    await new Promise((resolve) => provider.event(resolve));
    const [app] = await provider.getChildren(); // Populate appToResourceMap
    const categories = (await provider.getChildren(app)) as vscode.TreeItem[]; // gets the categories

    const dynosCategory = categories.find((c) => c.label === 'DYNOS');
    const dyno = (await provider.getChildren(dynosCategory))[0] as Dyno;

    const fireStub = sinon.stub(provider, 'fire');

    await new Promise((resolve) => setTimeout(resolve, 1100)); // wait for the stream to get setup
    stream.emit('data', 'heroku[web.1]: State changed from up to down\n');
    await new Promise((resolve) => setTimeout(resolve, 0)); // wait for promisified emit to complete

    assert.strictEqual(dyno.state, 'down');
    assert.ok(fireStub.calledWith(dyno));
  });

  test('onDynoStateChanged should add the new dyno when startup occurs', async () => {
    await provider.getChildren();
    await new Promise((resolve) => provider.event(resolve));
    const [app] = await provider.getChildren(); // Populate appToResourceMap
    const categories = (await provider.getChildren(app)) as vscode.TreeItem[]; // gets the categories

    const dynosCategory = categories.find((c) => c.label === 'DYNOS');
    let dynos = await provider.getChildren(dynosCategory); // populates the initial dynos.

    const fireStub = sinon.stub(provider, 'fire');

    await new Promise((resolve) => setTimeout(resolve, 1100)); // wait for the stream to get setup
    stream.emit('data', 'heroku[web.2]: Starting process with command `npm start`\n');
    await new Promise((resolve) => setTimeout(resolve, 5100)); // wait for promisified emit to complete

    dynos = await provider.getChildren(dynosCategory);

    assert.strictEqual(dynos.length, 2);
    assert.ok(fireStub.calledWith(dynosCategory));
  });
});
