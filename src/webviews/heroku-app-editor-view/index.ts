import { customElement, FASTElement } from '@microsoft/fast-element';
import type { AppJson, EnvironmentVariables } from '@heroku/app-json-schema';
import type { Space, Team } from '@heroku-cli/schema';
import {
  ProgressRing,
  provideVSCodeDesignSystem,
  vsCodeProgressRing,
  vsCodeTextField
} from '@vscode/webview-ui-toolkit';
import { commonCss, loadCss, loadHtmlTemplate, vscode } from '../utils/web-component-utils.js';
import { shadowChild } from '../meta/shadow-child.js';
import {
  HEROKU_REPO_CARD_TAG,
  type HerokuRepoCard,
  RepoCardData,
  RepoCardEvent
} from '../components/repo-card/index.js';
import { mapTeamsByEnterpriseAccount } from '../utils/map-teams-by-enterprise.js';
import { mapSpacesByOrganization } from '../utils/map-spaces-by-org.js';
import { GithubService } from '../heroku-starter-apps-view/github-service.js';

type DataPayload = {
  appJsonList: AppJson[];
  repoInfos: Array<{ owner: string; repo: string }>;
  githubAccessToken?: string;
  teams?: Team[];
  spaces?: Space[];
};
const template = await loadHtmlTemplate(import.meta.resolve('./index.html'));
const styles = (await loadCss([import.meta.resolve('./index.css')])).concat(commonCss);
@customElement({
  name: 'heroku-app-editor',
  template,
  styles
})
/**
 *
 */
export class HerokuAppEditor extends FASTElement {
  @shadowChild('#repo-card-template')
  private herokuRepoCardTemplate!: HTMLTemplateElement;

  @shadowChild('ul.repo-list')
  private repoList!: HTMLUListElement;

  @shadowChild('.loading-indicator')
  private loadingIndicator!: ProgressRing;

  private githubService = new GithubService();

  /**
   * @inheritdoc
   */
  public constructor() {
    super();
    provideVSCodeDesignSystem().register(vsCodeProgressRing(), vsCodeTextField());
  }

  /**
   * Handles the deploy event from the Repo Card
   *
   * @param event The event dispatched by the Repo Card
   */
  private static onDeploy(event: RepoCardEvent): void {
    vscode.postMessage({ type: 'deploy', payload: event.detail });
  }

  /**
   * @inheritdoc
   */
  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
    vscode.postMessage({ type: 'connected' });
  }

  /**
   * @inheritdoc
   */
  public disconnectedCallback(): void {
    window.removeEventListener('message', this.onMessage);
  }

  private onMessage = (event: MessageEvent<DataPayload>): void => {
    const { appJsonList = [], spaces, teams, githubAccessToken, repoInfos } = event.data;
    this.githubService.accessToken = githubAccessToken;
    const mappedSpaces = mapSpacesByOrganization(spaces);
    const mapTeams = mapTeamsByEnterpriseAccount(teams);

    void (async (): Promise<void> => {
      const repos = await Promise.all(repoInfos.map((info) => this.githubService.getRepo(info.owner, info.repo)));

      for (let i = 0; i < appJsonList.length; i++) {
        const appJson = appJsonList[i];
        const repo = repos[i];

        const li = this.herokuRepoCardTemplate.content.cloneNode(true) as DocumentFragment;
        const repoCard = li.querySelector(HEROKU_REPO_CARD_TAG) as HerokuRepoCard;
        this.repoList.appendChild(li);
        requestAnimationFrame(() => {
          repoCard.data = repo as RepoCardData;
          repoCard.spaces = mappedSpaces;
          repoCard.teams = mapTeams;
          repoCard.configVarsFetcher = (): EnvironmentVariables => appJson.env ?? {};
          repoCard.addEventListener(RepoCardEvent.DEPLOY, HerokuAppEditor.onDeploy);
          this.repoList.appendChild(repoCard);
        });
      }
      this.loadingIndicator.remove();
    })();
  };
}
