import vscode from 'vscode';
import { DocumentSelector } from 'vscode';
import manifest from '../extension/meta/oclif.manifest.json';
import { ShellScriptHoverProvider } from './providers/shell-script-hover-provider';
import { AuthenticationProvider } from './providers/authentication-provider';
import { HerokuResourceExplorerProvider } from './providers/resource-explorer/heroku-resource-explorer-provider';
import { FildeDecoratorProvider } from './providers/file-decorator/file-decorator-provider';
import * as shellCommandDecorator from './commands/heroku-shell-command-decorator';

import './commands/auth/welcome-view-sign-in';
import { HerokuContextMenuCommandRunner } from './commands/heroku-cli/heroku-context-menu-command-runner';
import { HerokuPsRunner } from './commands/heroku-cli/heroku-ps-runner';
import { HerokuAddOnCommandRunner } from './commands/heroku-cli/heroku-addon-command-runner';
import { HerokuRedisCommandRunner } from './commands/heroku-cli/heroku-redis-command-runner';

/**
 * Called when the extension is activated by VSCode
 *
 * @param context The extension context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext): void {
  void context.secrets.delete(AuthenticationProvider.SESSION_KEY);

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
        if (/^(ps)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuPsRunner.COMMAND_ID, command, ...args);
        } else if (/^(addons)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuAddOnCommandRunner.COMMAND_ID, command, ...args);
        } else if (/^(redis)(:?)/.test(command)) {
          void vscode.commands.executeCommand(HerokuRedisCommandRunner.COMMAND_ID, command, ...args);
        } else {
          void vscode.commands.executeCommand(HerokuContextMenuCommandRunner.COMMAND_ID, command, ...args);
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
