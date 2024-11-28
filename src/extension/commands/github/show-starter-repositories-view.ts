import EventEmitter from 'node:events';
import vscode, { AuthenticationSession, Uri, WebviewPanel } from 'vscode';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import importMap from '../../importmap.json';
import { convertImportMapPathsToUris } from '../../utils/import-paths-to-uri';
import { GithubService } from '../../services/github-service';
import { HerokuCommand } from '../heroku-command';
import { logExtensionEvent } from '../../utils/logger';
import { DeployToHeroku } from '../app/deploy-to-heroku';

@herokuCommand()
/**
 * The ShowAddonsViewCommand displays the addons marketplace
 * as a WebView in VSCode
 */
export class ShowStarterRepositories extends AbortController implements RunnableCommand<Promise<void>> {
  public static COMMAND_ID = 'heroku:github:show-starter-repositories' as const;
  private static addonsPanel: WebviewPanel | undefined;
  private githubService = new GithubService();

  private notifier: EventEmitter | undefined;

  /**
   * Creates and displays a webview for showing
   * the add-on marketplace
   *
   * @param extensionUri The Uri of the extension.
   * @param notifier The notification emitter.
   * @returns Promise<void>
   */
  public async run(extensionUri: vscode.Uri, notifier: EventEmitter): Promise<void> {
    this.notifier = notifier;

    ShowStarterRepositories.addonsPanel?.dispose();
    ShowStarterRepositories.addonsPanel = undefined;

    const options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'node_modules'),
        vscode.Uri.joinPath(extensionUri, 'out', 'webviews'),
        vscode.Uri.joinPath(extensionUri, 'out', 'webviews', 'img'),
        vscode.Uri.joinPath(extensionUri, 'resources')
      ]
    };
    const panel = vscode.window.createWebviewPanel('GetStarted', 'Heorku Starter Apps', vscode.ViewColumn.One, options);
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'marketing-github.svg');

    const { webview } = panel;

    webview.onDidReceiveMessage(this.onMessage);

    const onDiskPath = vscode.Uri.joinPath(extensionUri, 'out', 'webviews', 'heroku-starter-apps-view', 'index.js');
    const indexPath = webview.asWebviewUri(onDiskPath);
    const webViewImportMap = {
      ...importMap,
      imports: convertImportMapPathsToUris(webview, importMap.imports, extensionUri)
    };
    const malibuIconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'resources', 'hk-malibu', 'style.css')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    webview.html = `
    <html style="height: 100%;" lang="en">
    <head>
      <script type="importmap">
      ${JSON.stringify(webViewImportMap)}
      </script>

      <script type="module" src="${indexPath.toString()}"></script>
      <title></title>
    </head>
    <link href="${malibuIconsUri.toString()}" rel="stylesheet" />
    <link href="${codiconsUri.toString()}" rel="stylesheet" />
      <body style="min-height: 100%; display: flex;">
        <heroku-starter-apps>Web Component not available</heroku-starter-apps>
      </body>
    </html>`;

    ShowStarterRepositories.addonsPanel = panel;
    const herokuGettingStartedRepos = await this.githubService.searchRepositories({
      q: ['heroku-getting-started', 'user:heroku', 'sort:stars']
    });
    const referenceAppRepos = await this.githubService.searchRepositories({
      q: ['', 'user:heroku-reference-apps', 'sort:stars']
    });
    await webview.postMessage({ referenceAppRepos, herokuGettingStartedRepos });

    await new Promise((resolve) => panel.onDidDispose(resolve));
  }

  /**
   * Disposes of internal resources and aborts
   * any pending API requests.
   */
  public [Symbol.dispose](): void {
    this.notifier?.removeAllListeners();
    this.abort();
  }

  /**
   * Handles messages received from the webview.
   *
   * @param message The message object received from the webview.
   * @param message.type The message type received from the webview.
   * @param message.payload The payload received from the webview.
   */
  private onMessage = async (message: { type: string; payload: unknown }): Promise<void> => {
    if (message.type === 'deploy') {
      const gitUrl = message.payload as string;
      // Clone the selected repo at a location chosen by the user
      let clonedLocation: Uri | undefined;
      try {
        clonedLocation = await this.cloneRepo(message.payload as string);
        if (!clonedLocation) {
          logExtensionEvent('Aborting deployment to Heroku: user cancelled repository clone step');
          return;
        }
      } catch (error) {
        const errorMessage = `Aborting deployment to Heroku: failed to clone repository - ${(error as Error).message}`;
        logExtensionEvent(errorMessage);
        void vscode.window.showErrorMessage(errorMessage);
        return;
      }

      // Deploy the app to Heroku
      const folderName = gitUrl.split('/').pop()?.replace('.git', '');
      const folderUri = vscode.Uri.joinPath(clonedLocation, folderName!);
      const result = await vscode.commands.executeCommand(DeployToHeroku.COMMAND_ID, undefined, undefined, folderUri);
      debugger;
    }
  };

  /**
   *
   * @param repoUrl The URL of the repository to clone
   * @returns The URI of the cloned repository or undefined if the user cancelled the operation
   */
  private async cloneRepo(repoUrl: string): Promise<Uri | undefined> {
    const uris: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select this folder to clone to'
    });

    if (!uris) {
      return;
    }
    const gitProcess = HerokuCommand.exec(`git clone ${repoUrl}`, { cwd: uris[0].fsPath });
    const result = await HerokuCommand.waitForCompletion(gitProcess);
    if (result.exitCode !== 0) {
      throw new Error(result.errorMessage);
    }
    return uris[0];
  }

  /**
   * Generates a request init object for making API requests to the Heroku API.
   *
   * @returns A promise that resolves to a request init object.
   */
  private async generateRequestInit(): Promise<RequestInit> {
    const { accessToken } = (await vscode.authentication.getSession('heroku:auth:login', [])) as AuthenticationSession;
    return { signal: this.signal, headers: { Authorization: `Bearer ${accessToken.trim()}` } };
  }
}
