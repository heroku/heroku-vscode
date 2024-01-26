import * as vscode from 'vscode';

import {DocumentSelector} from "vscode";
import {ShellScriptHoverProvider} from "./providers/shell-script-hover-provider";

export function activate(context: vscode.ExtensionContext): void {
  const selector: DocumentSelector = {scheme: 'file', language: 'shellscript'};
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new ShellScriptHoverProvider())
  );

}

export function deactivate(): void {
}
