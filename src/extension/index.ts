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
import { WhoAmI, WhoAmIResult } from './commands/auth/whoami';

const authProviderId = 'heroku:auth:login';
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

    vscode.authentication.registerAuthenticationProvider(authProviderId, 'Heroku', new AuthenticationProvider(context)),
    vscode.authentication.onDidChangeSessions(onDidChangeSessions),

    vscode.window.registerTreeDataProvider(
      'heroku:resource-explorer:treeview',
      new HerokuResourceExplorerProvider(context)
    ),

    vscode.window.registerFileDecorationProvider(new FildeDecoratorProvider(context)),
    shellCommandDecorator.activate(context),
    ...registerCommandsfromManifest()
  );
  void onDidChangeSessions({ provider: { id: authProviderId, label: 'Heroku' } });
}

/**
 *
 * @param event The event dispatched by the auth provider
 */
async function onDidChangeSessions(event: vscode.AuthenticationSessionsChangeEvent): Promise<void> {
  if (event.provider.id !== authProviderId) {
    return;
  }
  const session = await vscode.authentication.getSession(authProviderId, []);
  const { account, token } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);

  if (!session?.accessToken && token) {
    const items = ['Cancel', 'Manage trusted extensions'];
    const choice = await vscode.window.showWarningMessage(
      'Your Heroku accout it not accesible to the extension.',
      ...items
    );
    if (choice === items[1]) {
      void vscode.commands.executeCommand('_manageTrustedExtensionsForAccount', {
        providerId: authProviderId,
        accountLabel: account.email
      });
    } else {
      void vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
    }
    return;
  }
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
