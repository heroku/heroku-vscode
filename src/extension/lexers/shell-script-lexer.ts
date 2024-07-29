import sh from 'mvdan-sh';
import * as vscode from 'vscode';
import { isInsideRangeBoundary } from './lexer-utils.js';

/**
 * The ShellScriptLexer class provides functionality
 * for the lexing and traversal of a shell script file.
 * The shell script document is provided by VSCode and
 * the lexer is provided by mvdan-sh.
 *
 */
export class ShellScriptLexer {
  private parser: sh.Parser = sh.syntax.NewParser();
  private shellAst: sh.File | undefined;
  private document: vscode.TextDocument | undefined;

  /**
   * Function to be called when the document is
   * updated or edited.
   *
   * @param document The shell script document provided by VSCode
   */
  public documentDidChange(document: vscode.TextDocument): void {
    this.document = document;
    this.shellAst = undefined;
  }

  /**
   *
   *
   * @param position The position of the cursor within the document.
   * @returns Any array of sh.Node that contains the specified position.
   */
  public findNodesAtPosition(position: vscode.Position): sh.Node[] {
    if (!this.shellAst) {
      this.shellAst = this.parser.Parse(this.document?.getText() ?? '');
    }
    const targets: sh.Node[] = [];
    sh.syntax.Walk(this.shellAst, (node: sh.Node) => {
      if (sh.syntax.NodeType(node) === 'File') {
        return true;
      }
      if (isInsideRangeBoundary(node, position)) {
        targets.push(node);
      }
      return true;
    });
    return targets;
  }
}
