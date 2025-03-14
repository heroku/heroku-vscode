import vscode from 'vscode';
import TeamService from '@heroku-cli/schema/services/team-service.js';
import SpaceService from '@heroku-cli/schema/services/space-service.js';
import { ValidatorResult } from 'jsonschema';
import type { AppJson } from '@heroku/app-json-schema';
import type { DeployPayload } from '@heroku/repo-card';
import AppService from '@heroku-cli/schema/services/app-service.js';
import { HerokuCommand } from '../heroku-command';
import { prepareHerokuWebview } from '../../utils/prepare-heroku-web-view';
import { readAppJson } from '../../utils/read-app-json';
import { logExtensionEvent } from '../../utils/logger';
import { generateRequestInit } from '../../utils/generate-service-request-init';
import { getGithubSession, getGitRepositoryInfoByUri } from '../../utils/git-utils';
import { herokuCommand } from '../../meta/command';
import { DeploymentOptions, DeployToHeroku } from './deploy-to-heroku';

@herokuCommand()
/**
 *
 */
export class ShowDeployAppEditor extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:deploy:show-app-editor' as const;
  private static webviewPanel: vscode.WebviewPanel | undefined;

  private teamService = new TeamService(fetch, 'https://api.heroku.com');
  private spaceService = new SpaceService(fetch, 'https://api.heroku.com');
  private appService = new AppService(fetch, 'https://api.heroku.com');

  private workspaceUris: vscode.Uri[] | undefined;
  private workspaceUrlByRepoName = new Map<string, vscode.Uri>();

  /**
   * Runs the command by preparing the webview
   * and adding listeners that will be used to
   * deliver data.
   *
   * @param extensionUri The extension uri
   * @param workspaceUris The workspace uris where an app.json can be found
   */
  public async run(extensionUri: vscode.Uri, workspaceUris: vscode.Uri | vscode.Uri[]): Promise<void> {
    ShowDeployAppEditor.webviewPanel?.dispose();
    this.workspaceUris = Array.isArray(workspaceUris) ? workspaceUris : [workspaceUris];

    const panel = prepareHerokuWebview(extensionUri, {
      viewType: 'heroku.app-editor',
      webviewTitle: 'Deploy to Heroku',
      iconUri: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'deploy.svg'),
      javascriptEntryUri: vscode.Uri.joinPath(extensionUri, 'out', 'webviews', 'heroku-app-editor-view', 'index.js'),
      webComponentTag: 'heroku-app-editor'
    });

    const { webview } = panel;
    webview.onDidReceiveMessage(this.onMessage);
    ShowDeployAppEditor.webviewPanel = panel;
    await new Promise((resolve) => panel.onDidDispose(resolve));
  }

  private onMessage = async (message: { type: string; payload: unknown }): Promise<void> => {
    if (message.type === 'connected') {
      logExtensionEvent('preparing deploy to heroku editor...');
      const requestInit = await generateRequestInit(this.signal);
      const repoInfos = await Promise.all(this.workspaceUris?.map(getGitRepositoryInfoByUri) ?? []);
      repoInfos.forEach((repoInfo, index) => {
        if (repoInfo) {
          this.workspaceUrlByRepoName.set(repoInfo.repo, this.workspaceUris![index]);
        }
      });

      const [teams, spaces, existingApps, githubSession, ...appJsonResults] = await Promise.allSettled([
        this.teamService.list(requestInit),
        this.spaceService.list(requestInit),
        this.appService.list(requestInit),
        getGithubSession(),
        ...(this.workspaceUris?.map(readAppJson) ?? [])
      ]);

      // Note that workspaces with just a Procfile
      // are still valid Heroku apps but cannot be
      // deployed using the AppSetup apis which require
      // an app.json. We need create an empty app.json
      // to include in the the tarball prior to deployment.
      const appJsonList = appJsonResults.map((appJson) => {
        if (appJson.status === 'fulfilled') {
          return appJson instanceof ValidatorResult ? {} : (appJson.value as AppJson);
        }
        return {};
      });

      await ShowDeployAppEditor.webviewPanel?.webview.postMessage({
        teams: teams.status === 'fulfilled' ? teams.value : undefined,
        spaces: spaces.status === 'fulfilled' ? spaces.value : undefined,
        existingApps: existingApps.status === 'fulfilled' ? existingApps.value : undefined,
        githubAccessToken: githubSession.status === 'fulfilled' ? githubSession.value?.accessToken : undefined,
        // These required ordinal alignment - one appJson for each repoInfo
        appJsonList,
        repoInfos
      });
    }

    if (message.type === 'deploy') {
      const { appName: name, env, internalRouting, repoName, spaceId, teamId } = message.payload as DeployPayload;

      const deploymentOptions: DeploymentOptions = {
        name,
        env,
        internalRouting,
        spaceId,
        teamId,
        rootUri: this.workspaceUrlByRepoName.get(repoName!)
      };
      void (async (): Promise<void> => {
        await vscode.commands.executeCommand(DeployToHeroku.COMMAND_ID, undefined, undefined, deploymentOptions);
        ShowDeployAppEditor.webviewPanel?.dispose();
      })();
    }
  };
}
