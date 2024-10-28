import vscode from 'vscode';
import { DocumentSelector } from 'vscode';
import manifest from '../extension/meta/oclif.manifest.json';
import { ShellScriptHoverProvider } from './providers/shell-script-hover-provider';
import { AuthenticationProvider } from './providers/authentication-provider';
import { HerokuResourceExplorerProvider } from './providers/resource-explorer/heroku-resource-explorer-provider';
import { FildeDecoratorProvider } from './providers/file-decorator/file-decorator-provider';
import * as shellCommandDecorator from './commands/heroku-shell-command-decorator';

import './commands/auth/welcome-view-sign-in';
import { HerokuAppsRunner } from './commands/heroku-cli/heroku-apps-runner';
import { HerokuPsRunner } from './commands/heroku-cli/heroku-ps-runner';
import { HerokuPgRunner } from './commands/heroku-cli/heroku-pg-runner';
import { HerokuRedisRunner } from './commands/heroku-cli/heroku-redis-runner';
import { HerokuUnknownCommandRunner } from './commands/heroku-cli/heroku-unknown-command-runner';

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
    ),

    vscode.window.registerFileDecorationProvider(new FildeDecoratorProvider(context)),
    shellCommandDecorator.activate(context),
    ...registerCommandsfromManifest()
  );

  void vscode.commands.executeCommand('setContext', 'heroku.app-found', true);
}

/**
 * Registers heroku commands from the manifest json
 *
 * @returns Disposables
 */
function registerCommandsfromManifest(): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  for (const command of Object.keys(manifest.commands)) {
    disposables.push(
      vscode.commands.registerCommand(`heroku:user:${command}`, (...args: unknown[]) => {
        if (/^(apps)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuAppsRunner.COMMAND_ID, command, ...args);
        } else if (/^(ps)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuPsRunner.COMMAND_ID, command, ...args);
        } else if (/^(pg)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuPgRunner.COMMAND_ID, command, ...args);
        } else if (/^(redis)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuRedisRunner.COMMAND_ID, command, ...args);
        } else {
          void vscode.commands.executeCommand(HerokuUnknownCommandRunner.COMMAND_ID, command, ...args);
        }
      })
    );
  }

  return disposables;
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {}
