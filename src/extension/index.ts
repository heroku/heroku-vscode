import vscode from 'vscode';
import { DocumentSelector } from 'vscode';

import { ShellScriptHoverProvider } from './providers/shell-script-hover-provider';
import { AuthenticationProvider } from './providers/authentication-provider';
import { WebviewProvider } from './providers/webview-provider';

export * from './commands/auth/welcome-view-sign-in';

export function activate(context: vscode.ExtensionContext): void {
  const selector: DocumentSelector = { scheme: 'file', language: 'shellscript' };
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new ShellScriptHoverProvider()),
    vscode.authentication.registerAuthenticationProvider('heroku:auth:login', 'Heroku', new AuthenticationProvider(context)),
    vscode.window.registerWebviewViewProvider("herokuai:geoff", new WebviewProvider(context))
  );
}

export function deactivate(): void {}
