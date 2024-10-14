import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FildeDecoratorProvider } from './file-decorator-provider';

suite('FildeDecoratorProvider', () => {
  let provider: FildeDecoratorProvider;
  let mockContext: vscode.ExtensionContext;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockContext = {} as vscode.ExtensionContext;
    provider = new FildeDecoratorProvider(mockContext);
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('provideFileDecoration', () => {
    test('should return null for non-heroku URIs', () => {
      const uri = { scheme: 'file', path: '/some/path' } as vscode.Uri;
      assert.strictEqual(provider.provideFileDecoration(uri), null);
    });

    test('should return null for heroku URIs that are not dynos', () => {
      const uri = { scheme: 'heroku', path: '/app/some-state' } as vscode.Uri;
      assert.strictEqual(provider.provideFileDecoration(uri), null);
    });

    test('should return correct decoration for up dyno', () => {
      const uri = { scheme: 'heroku', path: '/dyno/up' } as vscode.Uri;
      const decoration = provider.provideFileDecoration(uri);
      assert.deepStrictEqual(decoration, { badge: '🟢', tooltip: 'Dyno is up' });
    });

    test('should return correct decoration for idle dyno', () => {
      const uri = { scheme: 'heroku', path: '/dyno/idle' } as vscode.Uri;
      const decoration = provider.provideFileDecoration(uri);
      assert.deepStrictEqual(decoration, { badge: '🟡', tooltip: 'Dyno is idle' });
    });

    test('should return correct decoration for starting dyno', () => {
      const uri = { scheme: 'heroku', path: '/dyno/starting' } as vscode.Uri;
      const decoration = provider.provideFileDecoration(uri);
      assert.deepStrictEqual(decoration, { badge: '🟡', tooltip: 'Dyno is starting' });
    });

    test('should return correct decoration for down dyno', () => {
      const uri = { scheme: 'heroku', path: '/dyno/down' } as vscode.Uri;
      const decoration = provider.provideFileDecoration(uri);
      assert.deepStrictEqual(decoration, { badge: '🔴', tooltip: 'Dyno is down' });
    });

    test('should return correct decoration for crashed dyno', () => {
      const uri = { scheme: 'heroku', path: '/dyno/crashed' } as vscode.Uri;
      const decoration = provider.provideFileDecoration(uri);
      assert.deepStrictEqual(decoration, { badge: '🔴', tooltip: 'Dyno has crashed' });
    });
  });
});
