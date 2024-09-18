import vscode from 'vscode';
import { DocumentSelector } from 'vscode';

import { ShellScriptHoverProvider } from './providers/shell-script-hover-provider';
import { AuthenticationProvider } from './providers/authentication-provider';
import { HerokuResourceExplorerProvider } from './providers/heroku-resource-explorer-provider';

import './commands/auth/welcome-view-sign-in';

/**
 * Called when the extension is activated by VSCode
 *
 * @param context The extension context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext): void {
  const selector: DocumentSelector = { scheme: 'file', language: 'shellscript' };
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new ShellScriptHoverProvider()),
    vscode.authentication.registerAuthenticationProvider(
      'heroku:auth:login',
      'Heroku',
      new AuthenticationProvider(context)
    ),
    vscode.window.registerTreeDataProvider(
      'heroku:resource-explorer:treeview',
      new HerokuResourceExplorerProvider(context)
    )
  );

  void vscode.commands.executeCommand('setContext', 'heroku.app-found', true);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {}
