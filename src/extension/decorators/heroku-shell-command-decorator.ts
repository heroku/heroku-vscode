import * as vscode from 'vscode';
import { CallExpr, Lit, type Assign } from 'mvdan-sh';
import { ShellScriptLexer } from '../lexers/shell-script-lexer';
import {
  getVscodeRangeFromNode,
  isAssignmentOperation,
  isHerokuCallExpression,
  isLiteral
} from '../lexers/lexer-utils';
import { ExecuteCommandFromEditor } from '../commands/heroku-cli/execute-command-from-editor';

/**
 * The HerokuShellCommandDecorator is used to provide
 * decorations for shell scripts that may contain
 * Heroku CLI commands. The decorator provides a visual
 * indicator for Heroku CLI commands in the editor and
 * provides a command to execute the heroku call
 * expressions in the hover text.
 */
export class HerokuShellCommandDecorator {
  protected lexer = new ShellScriptLexer();
  protected decoration: vscode.TextEditorDecorationType | undefined;
  /**
   * Decorator command used to provide a visual
   * indicator for Heroku CLI commands in the
   * editor and provide a command to execute
   * the heroku call expressions in the hover
   * text.
   *
   * @param context The extension context
   */
  public decorateHerokuCommands(context: vscode.ExtensionContext): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    this.lexer.documentDidChange(document);

    const herokuCommandNodes = this.lexer.findAllNodeKinds(isHerokuCallExpression) as CallExpr[];
    if (!herokuCommandNodes.length) {
      return;
    }
    // Find all env var assignments that may be used
    // by a Heroku CLI command and include them in the
    // rawCommand. We do not make any attempt to filter
    // unused assignments.
    const assignNodes = this.lexer.findAllNodeKinds(isAssignmentOperation) as Assign[];
    let assignments = '';
    assignNodes.forEach((assignment) => {
      const envRange = getVscodeRangeFromNode(assignment);
      const envValue = document.getText(envRange);
      assignments += `${envValue}; `;
    });

    const decorationOptions: vscode.DecorationOptions[] = [];
    // Iterate found command and generate hover text
    // with a command execution link continuing the args
    // needed in the ExecuteCommandFromEditor class
    for (const command of herokuCommandNodes) {
      const [, commandNameLit] = this.lexer.findAllNodeKinds(isLiteral, command) as Lit[];
      const range = getVscodeRangeFromNode(command);
      const hydratedCommand = document.getText(range);
      const argParams = { hydratedCommand, assignments };
      const hoverMessage = new vscode.MarkdownString(
        `[$(play) Run command](command:${ExecuteCommandFromEditor.COMMAND_ID}?${encodeURIComponent(JSON.stringify([commandNameLit?.Value, argParams]))})`,
        true
      );
      hoverMessage.isTrusted = true;

      decorationOptions.push({
        range,
        hoverMessage
      });
    }
    editor.setDecorations(this.getDecoration(context.extensionUri), decorationOptions);
  }

  /**
   * Disposes of the decoration
   */
  public dispose(): void {
    this.decoration?.dispose();
  }

  /**
   * Gets the decoration
   *
   * @param extensionUri Uri of the extension
   * @returns The decoration
   */
  protected getDecoration(extensionUri: vscode.Uri): vscode.TextEditorDecorationType {
    return (this.decoration ??= vscode.window.createTextEditorDecorationType({
      dark: {
        gutterIconPath: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'logo-mark.svg'),
        gutterIconSize: '.5rem',
        before: {
          contentIconPath: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'play.svg'),
          width: '.5rem',
          margin: '0 .25rem 0 0'
        }
      },
      gutterIconSize: 'contain',
      gutterIconPath: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'logo-mark.svg')
    }));
  }
}

/**
 * Activate the decorator command and return a vscode.Disposable
 *
 * @param context The extension context
 * @returns A disposable object that can be used to dispose of the decoration providers
 */
export function activate(context: vscode.ExtensionContext): vscode.Disposable {
  const decorator = new HerokuShellCommandDecorator();
  /**
   * Change function
   */
  function changeFunction(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== 'shellscript') {
      return;
    }
    decorator.decorateHerokuCommands(context);
  }
  const disposables: vscode.Disposable[] = [
    vscode.window.onDidChangeVisibleTextEditors(changeFunction),
    vscode.workspace.onDidChangeTextDocument(changeFunction)
  ];
  changeFunction();
  return {
    dispose(): void {
      decorator.dispose();
      disposables.forEach((disposable) => void disposable.dispose());
    }
  };
}
