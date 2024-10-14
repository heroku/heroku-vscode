import sh from 'mvdan-sh';
import * as vscode from 'vscode';
import { isHerokuCallExpression, isInsideRangeBoundary, isPartialHerokuCallExpression } from './lexer-utils.js';

export type HerokuCommandEntity =
  | {
      type: 'heroku' | 'command';
      node: sh.Node;
      command?: never;
      flagKey?: never;
    }
  | {
      node: sh.Node;
      type: 'flag';
      flagKey: string;
      command: sh.Word;
    }
  | {
      node: sh.Node;
      type: 'arg';
      command: sh.Word;
      argIndex: number;
    };

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

  /**
   * Finds the heroku command entity at the specified position.
   *
   * @param position The position of the cursor in the document.
   * @param includePartialHerokuCallExpression Whether to include partial heroku call expressions.
   * @returns sh.Node | null
   */
  public findEntityAtPosition(
    position: vscode.Position,
    includePartialHerokuCallExpression = false
  ): HerokuCommandEntity | null {
    const nodes = this.findNodesAtPosition(position);
    const node = nodes.find(
      includePartialHerokuCallExpression ? isPartialHerokuCallExpression : isHerokuCallExpression
    );
    if (!node) {
      return null;
    }
    const { Args: args } = node;
    const [heroku, command, ...flagsOrArgs] = args;
    // -----------------------------------
    // We're over a heroku call expression
    // -----------------------------------
    if (isInsideRangeBoundary(heroku, position)) {
      return { type: 'heroku', node: heroku as sh.Word };
    }
    // ---------------------------
    // We're over a heroku command
    // ---------------------------
    if (isInsideRangeBoundary(command, position)) {
      return { type: 'command', node: command as sh.Word };
    }
    // -------------------------------
    // we're over a heroku flag or arg
    // -------------------------------
    const [targetFlagOrArg] = flagsOrArgs.filter((flagOrArg) => isInsideRangeBoundary(flagOrArg, position));
    if (!targetFlagOrArg) {
      return null;
    }

    const id = targetFlagOrArg.Lit();
    let flagKey: string = '';
    // This is either a command argument or a flag value.
    if (!id.startsWith('-')) {
      const idx = flagsOrArgs.indexOf(targetFlagOrArg);
      // back up in the list of flags or args
      // until we find the associated flag or
      // we determine this is a command arg.
      let i = idx;
      while (i-- > -1) {
        const maybeFlag = flagsOrArgs[i];
        const maybeFladId = maybeFlag?.Lit() ?? '';
        if (maybeFladId.startsWith('-')) {
          flagKey = maybeFladId.replace(/^[-]+/, '');
          break;
        }
      }
      // We didn't find a flag so this
      // must be a command argument
      if (!flagKey) {
        // args occur in the order in which the
        // properties are defined. Indexed
        // keys will be accurately mapped.

        return { node: targetFlagOrArg, type: 'arg', command: command as sh.Word, argIndex: idx };
      }
    } else if (id.startsWith('-')) {
      // might be in the format --flag=flag-value
      const [flagId] = id.split('=');
      flagKey = flagId.replace(/^[-]+/, '');
    }
    return { node: targetFlagOrArg, type: 'flag', flagKey, command: command as sh.Word };
  }
}
