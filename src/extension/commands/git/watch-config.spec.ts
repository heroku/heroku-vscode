import proxyquire from 'proxyquire';
import assert from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import type { GitRemoteAppsDiff } from './watch-config';
import { EventEmitter } from 'stream';

suite('WatchConfig', () => {
  let WatchConfig: (new () => { run: CallableFunction }) & { COMMAND_ID: string };
  let watchStub: sinon.SinonStub;
  let findGitConfigFileLocationStub: sinon.SinonStub;
  let getHerokuAppNamesStub: sinon.SinonStub;
  let vscodeStub: any;
  let watcher: AsyncIterable<GitRemoteAppsDiff>;
  let watcherEmitter = new EventEmitter();

  setup(() => {
    watcher = (async function* () {
      const result = await new Promise<GitRemoteAppsDiff>((resolve) => {
        watcherEmitter.once('change', () => {
          resolve({ added: new Set(), removed: new Set() });
        });
      });
      yield result;
    })();

    watchStub = sinon.stub().returns(watcher);
    findGitConfigFileLocationStub = sinon.stub().resolves('/path/to/.git/config');
    getHerokuAppNamesStub = sinon.stub().resolves(['app1', 'app2']);

    vscodeStub = {
      workspace: {
        workspaceFolders: [{ uri: { path: '/test/path' } }]
      },
      commands: {
        executeCommand: sinon.stub()
      }
    };

    WatchConfig = proxyquire('./watch-config', {
      'node:fs/promises': { watch: watchStub },
      '../../utils/git-utils': {
        findGitConfigFileLocation: findGitConfigFileLocationStub,
        getHerokuAppNames: getHerokuAppNamesStub
      },
      vscode: vscodeStub
    }).WatchConfig;
  });

  teardown(() => {
    sinon.restore();
  });

  test('is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const command = commands.find((command) => command === WatchConfig.COMMAND_ID);
    assert.ok(!!command, 'The WatchConfig command is not registered');
  });

  test('should watch for config changes and yield diffs', async () => {
    const watchConfig = new WatchConfig();
    const abortController = new AbortController();

    const generator = await watchConfig.run(abortController);

    // Simulate initial state
    getHerokuAppNamesStub.onFirstCall().resolves(['app1', 'app2']);

    // Start the generator
    const result1 = await generator.next();

    // Simulate a change event
    getHerokuAppNamesStub.onSecondCall().resolves(['app1', 'app3']);

    const promise = generator.next();
    // Simulate a change event with no actual changes
    watcherEmitter.emit('change', { eventType: 'change' });

    const result2 = await promise;

    assert.deepStrictEqual(result2.value, { added: new Set(['app3']), removed: new Set(['app2']) });

    abortController.abort();
  });

  test('should handle errors gracefully', async () => {
    const watchConfig = new WatchConfig();
    const abortController = new AbortController();

    findGitConfigFileLocationStub.rejects(new Error('Git config not found'));

    await assert.rejects(async () => await watchConfig.run(abortController), { message: 'Git config not found' });
  });
});
