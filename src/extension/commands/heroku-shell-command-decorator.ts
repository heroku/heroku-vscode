import * as vscode from 'vscode';
import { type Assign } from 'mvdan-sh';
import { ShellScriptLexer } from '../lexers/shell-script-lexer';
import { getVscodeRangeFromNode, isAssignmentOperation, isHerokuCallExpression } from '../lexers/lexer-utils';

import './heroku-cli/execute-command-from-editor';

const lexer = new ShellScriptLexer();
const decorations: vscode.TextEditorDecorationType[] = [];

/**
 * Decorator command used to provide a visual
 * indicator for Heroku CLI commands in the
 * editor and provide a command to execute
 * the heroku call expressions in the hover
 * text.
 *
 * @param context The extenstion context
 */
function decorateHerokuCommands(context: vscode.ExtensionContext): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  lexer.documentDidChange(document);
  // dispose
  while (decorations.length) {
    const decoration = decorations.pop();
    decoration?.dispose();
  }

  const herokuCommandNodes = lexer.findAllNodeKinds(isHerokuCallExpression);
  if (!herokuCommandNodes.length) {
    return;
  }
  // Find all env var assignents that may be used
  // by a Heroku CLI command and include them in the
  // rawCommand. We do not make any attempt to filter
  // unused assignments.
  const assignNodes = lexer.findAllNodeKinds(isAssignmentOperation) as Assign[];
  const env: Record<string, string> = {};
  let assignments = '';
  assignNodes.forEach((assignment) => {
    const envRange = getVscodeRangeFromNode(assignment);
    const envValue = document.getText(envRange);
    assignments += `${envValue}; `;
  });

  // Iterate found command and generate hover text
  // with a command execution link contining the args
  // needed in the ExecuteCommandFromEditor class
  for (const command of herokuCommandNodes) {
    const range = getVscodeRangeFromNode(command);
    const rawCommand = document.getText(range);
    const argParams = { assignments, rawCommand, env };
    const hoverMessage = new vscode.MarkdownString(
      `### [$(play) Run command](command:heroku:execute:from:editor?${encodeURIComponent(JSON.stringify(argParams))}), right click for more options`,
      true
    );
    hoverMessage.isTrusted = true;

    const decorationOptions: vscode.DecorationOptions = { range, hoverMessage };
    const decoration = vscode.window.createTextEditorDecorationType({
      dark: {
        gutterIconPath: vscode.Uri.joinPath(
          context.extensionUri,
          'resources',
          'icons',
          'malibu',
          'dark',
          'logo-mark.svg'
        ),
        gutterIconSize: '.5rem',
        before: {
          contentIconPath: vscode.Uri.joinPath(
            context.extensionUri,
            'resources',
            'icons',
            'malibu',
            'dark',
            'play.svg'
          ),
          width: '.5rem',
          margin: '0 .25rem 0 0'
        }
      },
      gutterIconSize: 'contain',
      gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'malibu', 'dark', 'logo-mark.svg')
    });
    decorations.push(decoration);

    editor.setDecorations(decoration, [decorationOptions]);
  }
}

/**
 * Activate the decorator command and return a vscode.Disposable
 *
 * @param context The extenstion context
 * @returns A disposable object that can be used to dispose of the decoration providers
 */
export function activate(context: vscode.ExtensionContext): vscode.Disposable {
  /**
   * Change function
   */
  function changeFunction(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== 'shellscript') {
      return;
    }
    decorateHerokuCommands(context);
  }
  const disposables: vscode.Disposable[] = [
    vscode.window.onDidChangeVisibleTextEditors(changeFunction),
    vscode.workspace.onDidChangeTextDocument(changeFunction)
  ];
  decorateHerokuCommands(context);
  return {
    dispose(): void {
      disposables.concat(decorations).forEach((disposable) => void disposable.dispose());
    }
  };
}
