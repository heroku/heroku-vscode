import { promisify } from 'node:util';
import vscode, { Uri, WebviewPanel } from 'vscode';
import TeamService from '@heroku-cli/schema/services/team-service.js';
import SpaceService from '@heroku-cli/schema/services/space-service.js';
import type { HerokuDeployButton } from '@heroku/elements';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import importMap from '../../importmap.json';
import { convertImportMapPathsToUris } from '../../utils/import-paths-to-uri';
import { HerokuCommand } from '../heroku-command';
import { logExtensionEvent, showExtensionLogs } from '../../utils/logger';
import { DeployToHeroku } from '../app/deploy-to-heroku';
import { generateRequestInit } from '../../utils/generate-service-request-init';
import { getGithubSession } from '../../utils/git-utils';

type StarterReposWebviewMessage =
  | {
      type: 'deploy';
      payload: {
        repoUrl: string;
        repoName: string;
        teamId: string;
        spaceId: string;
        internalRouting: boolean;
        env: Record<string, string>;
      };
    }
  | {
      type: 'connected';
      payload: never;
    };

@herokuCommand()
/**
 * The ShowAddonsViewCommand displays the addons marketplace
 * as a WebView in VSCode
 */
export class ShowStarterRepositories extends AbortController implements RunnableCommand<Promise<void>> {
  public static COMMAND_ID = 'heroku:github:show-starter-repositories' as const;
  private static webviewPanel: WebviewPanel | undefined;
  private teamService = new TeamService(fetch, 'https://api.heroku.com');
  private spaceService = new SpaceService(fetch, 'https://api.heroku.com');

  /**
   * Creates and displays a webview for showing
   * the add-on marketplace
   *
   * @param extensionUri The Uri of the extension.
   * @returns Promise<void>
   */
  public async run(extensionUri: vscode.Uri): Promise<void> {
    ShowStarterRepositories.webviewPanel?.dispose();
    ShowStarterRepositories.webviewPanel = undefined;

    const options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'node_modules'),
        vscode.Uri.joinPath(extensionUri, 'out', 'webviews'),
        vscode.Uri.joinPath(extensionUri, 'out', 'webviews', 'img'),
        vscode.Uri.joinPath(extensionUri, 'resources')
      ]
    };
    const panel = vscode.window.createWebviewPanel('GetStarted', 'Heroku Starter Apps', vscode.ViewColumn.One, options);
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
      <body style="min-height: 100%; display: flex; overflow:hidden;">
        <heroku-starter-apps>Loading...</heroku-starter-apps>
      </body>
    </html>`;

    ShowStarterRepositories.webviewPanel = panel;
    await new Promise((resolve) => panel.onDidDispose(resolve));
  }

  /**
   * Disposes of internal resources and aborts
   * any pending API requests.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }

  /**
   * Handles messages received from the webview.
   *
   * @param message The message object received from the webview.
   */
  private onMessage = async (message: StarterReposWebviewMessage): Promise<void> => {
    if (message.type === 'connected') {
      logExtensionEvent('Attempting to find Heroku starter repos in GitHub');
      const requestInit = await generateRequestInit(this.signal);

      logExtensionEvent('Attempting to find teams and spaces for user');
      const [teams, spaces, githubSession] = await Promise.allSettled([
        this.teamService.list(requestInit),
        this.spaceService.list(requestInit),
        getGithubSession()
      ]);
      await ShowStarterRepositories.webviewPanel?.webview.postMessage({
        teams: teams.status === 'fulfilled' ? teams.value : undefined,
        spaces: spaces.status === 'fulfilled' ? spaces.value : undefined,
        githubAccessToken: githubSession.status === 'fulfilled' ? githubSession.value?.accessToken : undefined
      });
    }

    if (message.type === 'deploy') {
      await this.doDeployment(message.payload);
    }
  };

  /**
   * Performs the deployment to Heroku with the provided options.
   *
   * @param deploymentOptions the options for deployment to Heroku
   */
  private async doDeployment(deploymentOptions: StarterReposWebviewMessage['payload']): Promise<void> {
    const { repoName, repoUrl, spaceId, teamId, env, internalRouting } = deploymentOptions;
    showExtensionLogs();
    logExtensionEvent(`Clone and deployment to Heroku initiated for: ${repoName}`);
    const cloneResultPromise = vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Cloning Repo...',
        cancellable: true
      },
      async (progress, token) => {
        const cancellationPromise: Promise<void> = promisify(token.onCancellationRequested)();
        const taskPromise = (async (): Promise<Uri | undefined> => {
          // Clone the selected repo at a location chosen by the user
          const clonedLocation = await this.cloneRepo(repoUrl);
          if (!clonedLocation) {
            throw new Error('Aborting deployment to Heroku: user cancelled repository clone step');
          }
          progress.report({ increment: 100 });
          return clonedLocation;
        })();

        return Promise.race([cancellationPromise, taskPromise]);
      }
    );
    let cloneResult: void | vscode.Uri | null;
    try {
      cloneResult = await cloneResultPromise;
    } catch (error) {
      const errorMessage = `Aborting deployment to Heroku: failed to clone repository - ${(error as Error).message}`;
      logExtensionEvent(errorMessage);
      void vscode.window.showErrorMessage(errorMessage);
      return;
    }
    if (!cloneResult) {
      logExtensionEvent('Aborting deployment to Heroku: user cancelled');
      return;
    }
    // Deploy the app to Heroku
    const gitUrl = repoUrl;
    const folderName = gitUrl.split('/').pop()?.replace('.git', '');
    const localRepositoryRootUri = vscode.Uri.joinPath(cloneResult, folderName!);
    const result = await vscode.commands.executeCommand<{ name: string } | null | undefined>(
      DeployToHeroku.COMMAND_ID,
      undefined,
      undefined,
      { spaceId, teamId, env, internalRouting, rootUri: localRepositoryRootUri, skipSuccessMessage: true }
    );
    // A result is only given when the clone and deploy is successful
    if (result) {
      const response = await vscode.window.showInformationMessage(
        `Successfully deployed ${repoName} as "${result.name}" to Heroku. Would you like to open the workspace?`,
        'No',
        'Yes'
      );
      if (response === 'Yes') {
        void vscode.commands.executeCommand('vscode.openFolder', localRepositoryRootUri);
      }
    }
  }

  /**
   * Presents the user with a dialog to select
   * a directory to clone the repo to and then
   * clones the repo using the provided URL argument.
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
    const result = await HerokuCommand.waitForCompletion(gitProcess, {
      sendText: (str: string) => logExtensionEvent(str, 'git')
    });
    if (result.exitCode !== 0) {
      throw new Error(result.errorMessage);
    }
    return uris[0];
  }

  /**
   *
   * Gets the Buttons from the heroku elements api.
   *
   * @returns a promise that resolves to the HerokuDeployButtonResponse or undefined if the request fails
   */
  private async getButtons(): Promise<HerokuDeployButton[] | undefined> {
    const result = await fetch('./elements-buttons.json');
    if (result.ok) {
      return (await result.json()) as HerokuDeployButton[];
    }
    return undefined;
  }
}
