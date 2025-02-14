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

  const begin = nodePosToVScodePosition(node.Pos());
  const end = nodePosToVScodePosition(node.End());
  const { line, character } = position;

  if (line < begin.line || line > end.line) {
    return false;
  }

  return begin.line === line && character >= begin.character && character <= end.character;
}

/**
 * Determines if the specified node is a sh.ParamExp.
 *
 * @param node The node to test
 * @returns boolean
 */
export function isParamExpansion(node: sh.Node): node is sh.ParamExp {
  return sh.syntax.NodeType(node) === 'ParamExp';
}

/**
 * Determines if the specified node is a sh.Assign
 *
 * @param node The node to test
 * @returns boolean
 */
export function isAssignmentOperation(node: sh.Node): node is sh.Assign {
  return sh.syntax.NodeType(node) === 'Assign';
}

/**
 * Get the vscode position for the specified node
 *
 * @param pos The node position to convert to a vscode position
 * @returns the vscode position for the specified node
 */
export function nodePosToVScodePosition(pos: sh.Pos): vscode.Position {
  return new vscode.Position(pos.Line() - 1, pos.Col() - 1);
}

/**
 * Get the vscode range for the specified node
 *
 * @param node The node to get the vscode range from
 * @returns the vscode range for the specified node
 */
export function getVscodeRangeFromNode(node: sh.Node): vscode.Range {
  return new vscode.Range(nodePosToVScodePosition(node.Pos()), nodePosToVScodePosition(node.End()));
}
