import sh from 'mvdan-sh';
import * as vscode from 'vscode';

/**
 * Determines if the specified node is a heroku
 * command call expression. This test is true
 * if the node is a sh.CallExpr and contains the
 * "heroku" string literal as the first argument.
 *
 * @param node The node to test.
 * @returns boolean
 */
export function isHerokuCallExpression(node: sh.Node | undefined): node is sh.CallExpr {
  return (
    !!node &&
    isCallExpr(node) &&
    !!node.Args.length &&
    !!node.Args[0]?.Parts?.length &&
    isLiteral(node.Args[0].Parts[0]) &&
    node.Args[0].Parts[0].Value === 'heroku'
  );
}

/**
 * Determines if the specified node is a partial heroku
 * command call expression. This test is true
 * if the node is a sh.CallExpr and contains a
 * string literal as the first argument which
 * is a partial match to "heroku" and contains
 * at least the chars "her".
 *
 * @param node The node to test.
 * @returns boolean
 */
export function isPartialHerokuCallExpression(node: sh.Node | undefined): node is sh.CallExpr {
  return (
    !!node &&
    isCallExpr(node) &&
    !!node.Args.length &&
    !!node.Args[0]?.Parts?.length &&
    isLiteral(node.Args[0].Parts[0]) &&
    /^(?:her)(?:o|$)(?:k|$)(?:u|$)/.test(node.Args[0].Parts[0].Value)
  );
}

/**
 * Determines if the specified node is a sh.CallExpr.
 *
 * @param node The node to test.
 * @returns boolean
 */
export function isCallExpr(node: sh.Node): node is sh.CallExpr {
  return sh.syntax.NodeType(node) === 'CallExpr';
}

/**
 * Determines if the specified node is a sh.Lit
 *
 * @param node The node to test.
 * @returns boolean
 */
export function isLiteral(node: sh.Node): node is sh.Lit {
  return sh.syntax.NodeType(node) === 'Lit';
}

/**
 * Determines if the specified position occurs
 * within the provided sh.Node range boundary.
 *
 * @param node The node to test.
 * @param position The target position to determine if it occurs in the specified node.
 * @returns boolean
 */
export function isInsideRangeBoundary(node: sh.Node | null, position: vscode.Position): boolean {
  if (!node) {
    return false;
  }

  const begin = { line: node.Pos().Line(), character: node.Pos().Col() };
  const end = { line: node.End().Line(), character: node.End().Col() };
  const line = position.line + 1;
  const character = position.character;

  if (line < begin.line || line > end.line) {
    return false;
  }

  return begin.line === line && character >= begin.character && character <= end.character;
}
