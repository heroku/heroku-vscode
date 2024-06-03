import vscode from 'vscode';
import { DocumentSelector } from 'vscode';
import pjson from '../package.json';

import { ShellScriptHoverProvider } from './providers/shell-script-hover-provider.js';
Reflect.defineProperty(pjson.contributes, 'commands', {
  value: [
    {
      title: 'Heroku:command',
      command: 'heroku:command'
    }
  ]
});

export function activate(context: vscode.ExtensionContext): void {
  const selector: DocumentSelector = { scheme: 'file', language: 'shellscript' };
  context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new ShellScriptHoverProvider()));
}

export function deactivate(): void {}
