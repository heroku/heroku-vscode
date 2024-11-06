import * as assert from 'node:assert';
import * as vscode from 'vscode';
import Sinon, { type SinonStub } from 'sinon';
import { HerokuShellCommandDecorator, activate } from './heroku-shell-command-decorator';
import { ShellScriptLexer } from '../lexers/shell-script-lexer';
import type sh from 'mvdan-sh';

suite('The HerokuShellCommandDecorator', () => {
  let decorator: HerokuShellCommandDecorator;
  let mockContext: vscode.ExtensionContext;
  let mockEditor: vscode.TextEditor;
  let mockDocument: vscode.TextDocument;
  let windowStub: SinonStub;
  let workspaceStub: SinonStub;
  let lexerStub: SinonStub;

  setup(() => {
    decorator = new HerokuShellCommandDecorator();
    mockContext = {
      extensionUri: vscode.Uri.file('/test/extension'),
      subscriptions: []
    } as unknown as vscode.ExtensionContext;

    mockDocument = {
      languageId: 'shellscript',
      getText: Sinon.stub().returns('heroku apps:info')
    } as unknown as vscode.TextDocument;

    mockEditor = {
      document: mockDocument,
      setDecorations: Sinon.stub()
    } as unknown as vscode.TextEditor;

    windowStub = Sinon.stub(vscode.window, 'activeTextEditor').value(mockEditor);
    workspaceStub = Sinon.stub(vscode.workspace, 'onDidChangeTextDocument').returns({ dispose: Sinon.stub() });
    lexerStub = Sinon.stub(ShellScriptLexer.prototype, 'findAllNodeKinds').returns([
      {
        Value: 'heroku',
        End: (): sh.Pos => ({ Offset: () => 0, Line: () => 26, Col: () => 14 }) as sh.Pos,
        Pos: (): sh.Pos => ({ Offset: () => 0, Line: () => 26, Col: () => 8 }) as sh.Pos
      } as sh.Lit,
      {
        Value: 'apps:info',
        End: (): sh.Pos => ({ Offset: () => 0, Line: () => 26, Col: () => 25 }) as sh.Pos,
        Pos: (): sh.Pos => ({ Offset: () => 0, Line: () => 26, Col: () => 16 }) as sh.Pos
      } as sh.Lit
    ]);
  });

  teardown(() => {
    Sinon.restore();
  });

  test('activate registers event listeners and calls decorateHerokuCommands', () => {
    const disposable = activate(mockContext);

    assert.ok(workspaceStub.calledOnce, 'workspace.onDidChangeTextDocument should be called');
    assert.ok((mockEditor.setDecorations as SinonStub).calledOnce, 'editor.setDecorations should be called');

    disposable.dispose();
  });

  test('decorateHerokuCommands does not decorate if no editor is active', () => {
    windowStub.value(undefined);

    decorator.decorateHerokuCommands(mockContext);

    assert.ok((mockEditor.setDecorations as SinonStub).notCalled, 'editor.setDecorations should not be called');
  });

  test('decorateHerokuCommands decorates Heroku commands', () => {
    decorator.decorateHerokuCommands(mockContext);

    assert.equal(lexerStub.callCount, 4, 'ShellScriptLexer.findAllNodeKinds should be called 4 times');
    assert.ok((mockEditor.setDecorations as SinonStub).calledOnce, 'editor.setDecorations should be called');
  });

  test('getDecoration creates and returns a TextEditorDecorationType', () => {
    const createDecorTypeStub = Sinon.stub(vscode.window, 'createTextEditorDecorationType').returns(
      {} as vscode.TextEditorDecorationType
    );

    const result = decorator['getDecoration'](mockContext.extensionUri);

    assert.ok(result, 'getDecoration should return a value');
    assert.ok(createDecorTypeStub.calledOnce, 'window.createTextEditorDecorationType should be called');
  });
});
