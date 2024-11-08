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
  protected parser: sh.Parser = sh.syntax.NewParser();
  protected document: vscode.TextDocument | undefined;

  #shellAst: sh.File | undefined;
  /**
   * getter for the shell script document.
   *
   * @returns The shell script document provided by VSCode
   */
  protected get shellAst(): sh.File {
    if (!this.#shellAst) {
      this.#shellAst = this.parser.Parse(this.document?.getText() ?? '');
    }
    return this.#shellAst;
  }

  /**
   * Function to be called when the document is
   * updated or edited.
   *
   * @param document The shell script document provided by VSCode
   */
  public documentDidChange(document: vscode.TextDocument): void {
    this.document = document;
    this.#shellAst = undefined;
  }

  /**
   * Find all nodes in the document that are at the specified position.
   *
   * @param position The position of the cursor within the document.
   * @returns Any array of sh.Node that contains the specified position.
   */
  public findNodesAtPosition(position: vscode.Position): sh.Node[] {
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

  /**
   * Find all nodes in the document that match the specified matcher function.
   *
   * @param matcher matcher function to call.
   * @param node The node to start the search from. If omitted, the search will start from the root node.
   * @returns Any array of sh.Node that matches the specified matcher function.
   */
  public findAllNodeKinds(matcher: (node: sh.Node) => boolean, node?: sh.Node): sh.Node[] {
    const targets: sh.Node[] = [];
    sh.syntax.Walk(node ?? this.shellAst, (child: sh.Node) => {
      if (sh.syntax.NodeType(child) === 'File') {
        return true;
      }
      if (matcher(child)) {
        targets.push(child);
      }
      return true;
    });
    return targets;
  }
}
