import vscode from 'vscode';
import { DocumentSelector } from 'vscode';
import manifest from '../extension/meta/oclif.manifest.json';
import { ShellScriptHoverProvider } from './providers/shell-script-hover-provider';
import { AuthenticationProvider } from './providers/authentication-provider';
import { HerokuResourceExplorerProvider } from './providers/resource-explorer/heroku-resource-explorer-provider';
import { FileDecoratorProvider } from './providers/file-decorator/file-decorator-provider';

import { HerokuContextMenuCommandRunner } from './commands/heroku-cli/heroku-context-menu-command-runner';
import { HerokuPsRunner } from './commands/heroku-cli/heroku-ps-runner';
import { HerokuAddOnCommandRunner } from './commands/heroku-cli/heroku-addon-command-runner';
import { HerokuRedisCommandRunner } from './commands/heroku-cli/heroku-redis-command-runner';
import { WhoAmI, WhoAmIResult } from './commands/auth/whoami';
import { logExtensionEvent } from './utils/logger';
import { WelcomeViewSignIn } from './commands/auth/welcome-view-sign-in';
import * as herokuShellCommandDecorator from './decorators/heroku-shell-command-decorator';
import * as deployToHerokuDecorator from './decorators/deploy-to-heroku-decorator';
import { ShowStarterRepositories } from './commands/github/show-starter-repositories-view';
import { LinkApp } from './commands/app/link-app';

import './commands/auth/welcome-view-sign-in';
import './commands/github/show-starter-repositories-view';
import './commands/add-on/show-addons-view';
import { ShowDeployAppEditor } from './commands/app/show-deploy-app-editor';

const authProviderId = 'heroku:auth:login';
const workspacesWithHerokuFiles: vscode.Uri[] = [];
/**
 * Called when the extension is activated by VSCode
 *
 * @param context The extension context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext): void {
  void context.secrets.delete(AuthenticationProvider.SESSION_KEY);
  const { authentication, languages, commands, window } = vscode;
  const selector: DocumentSelector = { scheme: 'file', language: 'shellscript' };
  context.subscriptions.push(
    herokuShellCommandDecorator.activate(context),
    deployToHerokuDecorator.activate(context),
    languages.registerHoverProvider(selector, new ShellScriptHoverProvider()),

    authentication.registerAuthenticationProvider(authProviderId, 'Heroku', new AuthenticationProvider(context)),
    authentication.onDidChangeSessions(onDidChangeSessions),

    window.registerTreeDataProvider('heroku:resource-explorer:treeview', new HerokuResourceExplorerProvider(context)),

    window.registerFileDecorationProvider(new FileDecoratorProvider(context)),

    ...registerCommandsFromManifest(),

    commands.registerCommand('heroku:welcome:github:browse', () => {
      void commands.executeCommand(ShowStarterRepositories.COMMAND_ID, context.extensionUri);
    }),

    commands.registerCommand('heroku:welcome:link:apps', () => {
      void commands.executeCommand(LinkApp.COMMAND_ID, context.extensionUri);
    }),
    commands.registerCommand('heroku:welcome:deploy-to-heroku', () => {
      void commands.executeCommand(ShowDeployAppEditor.COMMAND_ID, context.extensionUri, workspacesWithHerokuFiles);
    })
  );
  void onDidChangeSessions({ provider: { id: authProviderId, label: 'Heroku' } });
  void monitorWorkspaceForHerokuAppExistence();
}

/**
 * Aggregates a list of workspace Uris where
 * either a Procfile or app.json exists.
 *
 * @returns void
 */
async function monitorWorkspaceForHerokuAppExistence(): Promise<void> {
  const { workspace } = vscode;
  for (const folder of workspace.workspaceFolders ?? []) {
    const { uri } = folder;
    const herokuFiles = await getHerokuFiles(uri);
    if (herokuFiles.length) {
      workspacesWithHerokuFiles.push(uri);
    }
  }
  await vscode.commands.executeCommand(
    'setContext',
    'heroku:workspace:has-heroku-files',
    workspacesWithHerokuFiles.length > 0
  );
}

/**
 * Finds the Procfile and app.json based on the
 * uri provided.
 *
 * @param uri The root uri to look for the files
 * @returns an array of Uri or empty if none are found
 */
async function getHerokuFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {
  const include = new vscode.RelativePattern(uri, '{Procfile,app.json}');
  const exclude = new vscode.RelativePattern(uri, '**/node_modules/**');

  return vscode.workspace.findFiles(include, exclude);
}

let sessionCheckDebounce: NodeJS.Timeout;
/**
 * Session change handler for vscode.
 *
 * @param event The event dispatched by the auth provider
 */
function onDidChangeSessions(event: vscode.AuthenticationSessionsChangeEvent): void {
  if (event.provider.id !== authProviderId) {
    return;
  }

  clearTimeout(sessionCheckDebounce);

  /**
   * Checks the user's access to Heroku when
   * the session changes. If no session is available
   * but the CLI is showing an access token,
   * the extension will prompt the user to log in again.
   */
  async function checkSession(): Promise<void> {
    const session = await vscode.authentication.getSession(authProviderId, []);
    const { token } = await vscode.commands.executeCommand<WhoAmIResult>(WhoAmI.COMMAND_ID);

    if (!session?.accessToken && token) {
      logExtensionEvent('Heroku account it not accessible to the extension');
      const items = ['Cancel', 'Log in again'];
      const choice = await vscode.window.showWarningMessage(
        'Your Heroku account it not accessible to the extension.',
        ...items
      );
      if (choice === items[1]) {
        void vscode.commands.executeCommand(WelcomeViewSignIn.COMMAND_ID);
      } else {
        void vscode.commands.executeCommand('setContext', 'heroku:login:required', true);
      }
      return;
    }
  }
  sessionCheckDebounce = setTimeout(() => void checkSession(), 1500);
}

/**
 * Registers heroku commands from the manifest json
 *
 * @returns Disposables
 */
function registerCommandsFromManifest(): vscode.Disposable[] {
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
