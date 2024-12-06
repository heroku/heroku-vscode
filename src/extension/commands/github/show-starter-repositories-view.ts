import { promisify } from 'node:util';
import vscode, { Uri, WebviewPanel } from 'vscode';
import TeamService from '@heroku-cli/schema/services/team-service.js';
import SpaceService from '@heroku-cli/schema/services/space-service.js';
import { herokuCommand, RunnableCommand } from '../../meta/command';
import { logExtensionEvent, showExtensionLogs } from '../../utils/logger';
import { DeployToHeroku } from '../app/deploy-to-heroku';
import { generateRequestInit } from '../../utils/generate-service-request-init';
import { getGithubSession } from '../../utils/git-utils';
import { prepareHerokuWebview } from '../../utils/prepare-heroku-web-view';
import { CloneRepository } from './clone-repository';

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

    const panel = prepareHerokuWebview(extensionUri, {
      viewType: 'heroku.getting-started',
      webviewTitle: 'Heroku Starter Apps',
      iconUri: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'marketing-github.svg'),
      javascriptEntryUri: vscode.Uri.joinPath(extensionUri, 'out', 'webviews', 'heroku-starter-apps-view', 'index.js'),
      webComponentTag: 'heroku-starter-apps'
    });

    const { webview } = panel;
    webview.onDidReceiveMessage(this.onMessage);
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
      logExtensionEvent('getting Heroku starter repos in GitHub');
      const requestInit = await generateRequestInit(this.signal);

      logExtensionEvent('getting teams and spaces for user');
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
          const cloneRepoCommand = new CloneRepository();
          const clonedLocation = await cloneRepoCommand.run(repoUrl);
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
}
