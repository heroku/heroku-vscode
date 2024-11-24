import * as vscode from 'vscode';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { activate, DeployToHerokuDecorator } from './deploy-to-heroku-decorator';
import { DeployToHeroku } from '../commands/app/deploy-to-heroku';

suite('DeployToHerokuDecorator Tests', () => {
  let decorator: DeployToHerokuDecorator;
  let mockContext: vscode.ExtensionContext;
  let mockEditor: vscode.TextEditor;
  let mockDocument: vscode.TextDocument;
  let mockWorkspaceFolder: vscode.WorkspaceFolder;
  let mockUri: vscode.Uri;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Create mock URI
    mockUri = {
      fsPath: '/workspace/app.json',
      joinPath: () => mockUri,
      path: '/workspace/app.json',
      with: () => mockUri
    } as unknown as vscode.Uri;

    // Create mock workspace folder
    mockWorkspaceFolder = {
      uri: mockUri,
      name: 'test-workspace',
      index: 0
    };

    // Create mock document
    mockDocument = {
      uri: mockUri,
      languageId: 'json'
    } as unknown as vscode.TextDocument;

    // Create mock editor
    mockEditor = {
      document: mockDocument,
      setDecorations: sandbox.stub()
    } as unknown as vscode.TextEditor;

    // Create mock extension context
    mockContext = {
      extensionUri: mockUri
    } as unknown as vscode.ExtensionContext;

    // Setup VS Code window stubs
    sandbox.stub(vscode.window, 'activeTextEditor').get(() => mockEditor);
    sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => [mockWorkspaceFolder]);
    sandbox.stub(vscode.window, 'createTextEditorDecorationType').returns({
      dispose: sandbox.stub()
    } as unknown as vscode.TextEditorDecorationType);

    decorator = new DeployToHerokuDecorator();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('decorateAppJson should add decorations when file is root app.json', () => {
    decorator.maybeDecorate(mockContext);

    assert.strictEqual(
      (mockEditor.setDecorations as sinon.SinonStub).calledOnce,
      true,
      'setDecorations should be called once'
    );

    const decorationCall = (mockEditor.setDecorations as sinon.SinonStub).getCall(0);
    const decorationOptions = decorationCall.args[1];

    assert.strictEqual(decorationOptions.length, 1, 'Should have one decoration option');
    assert.strictEqual(
      decorationOptions[0].hoverMessage.value.includes(DeployToHeroku.COMMAND_ID),
      true,
      'Hover message should include deploy command'
    );
  });

  test('decorateAppJson should not add decorations when no active editor', () => {
    sandbox.stub(vscode.window, 'activeTextEditor').get(() => undefined);

    decorator.maybeDecorate(mockContext);

    assert.strictEqual(
      (mockEditor.setDecorations as sinon.SinonStub).called,
      false,
      'setDecorations should not be called'
    );
  });

  test('decorateAppJson should not add decorations for non-root app.json', () => {
    const differentUri = {
      fsPath: '/workspace/subfolder/app.json',
      joinPath: () => differentUri
    } as unknown as vscode.Uri;

    Reflect.set(mockEditor.document, 'uri', differentUri);

    decorator.maybeDecorate(mockContext);

    assert.strictEqual(
      (mockEditor.setDecorations as sinon.SinonStub).called,
      false,
      'setDecorations should not be called'
    );
  });

  test('dispose should cleanup decoration', () => {
    const disposeStub = sandbox.stub();
    decorator['decoration'] = {
      dispose: disposeStub
    } as unknown as vscode.TextEditorDecorationType;

    decorator.dispose();

    assert.strictEqual(disposeStub.calledOnce, true, 'dispose should be called on decoration');
  });

  test('getDecoration should create decoration type only once', () => {
    const decoration1 = decorator['getDecoration'](mockUri);
    const decoration2 = decorator['getDecoration'](mockUri);

    assert.strictEqual(decoration1, decoration2, 'Should return same decoration instance');
    assert.strictEqual(
      (vscode.window.createTextEditorDecorationType as sinon.SinonStub).calledOnce,
      true,
      'Should create decoration type only once'
    );
  });

  suite('activate function', () => {
    test('should register event listeners and return disposable', () => {
      const onDidChangeVisibleEditorsStub = sandbox
        .stub(vscode.window, 'onDidChangeVisibleTextEditors')
        .returns({ dispose: sandbox.stub() });
      const onDidChangeTextDocumentStub = sandbox
        .stub(vscode.workspace, 'onDidChangeTextDocument')
        .returns({ dispose: sandbox.stub() });

      const disposable = activate(mockContext);

      assert.strictEqual(
        onDidChangeVisibleEditorsStub.calledOnce,
        true,
        'Should register visible editors change listener'
      );
      assert.strictEqual(onDidChangeTextDocumentStub.calledOnce, true, 'Should register text document change listener');

      // Test dispose cleanup
      disposable.dispose();
      assert.strictEqual(decorator['decoration'], undefined, 'Decoration should be cleaned up');
    });

    test('changeFunction should not decorate non-json files', () => {
      Reflect.set(mockDocument, 'languageId', 'typescript');

      const disposable = activate(mockContext);

      assert.strictEqual(
        (mockEditor.setDecorations as sinon.SinonStub).called,
        false,
        'Should not decorate non-json files'
      );

      disposable.dispose();
    });
  });
});
