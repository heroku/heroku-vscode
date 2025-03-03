import { customElement, FASTElement } from '@microsoft/fast-element';
import {
  provideVSCodeDesignSystem,
  vsCodeTextField,
  vsCodeProgressRing,
  type TextField,
  type ProgressRing
} from '@vscode/webview-ui-toolkit';
import type { RepoSearchResultItem } from 'github-api';
import type { App, Space, Team } from '@heroku-cli/schema';
import type { EnvironmentVariables } from '@heroku/app-json-schema';
import { HerokuDeployButton } from '@heroku/elements';
import { commonCss, loadCss, loadHtmlTemplate, vscode } from '../utils/web-component-utils.js';
import { shadowChild } from '../meta/shadow-child.js';
import { HEROKU_REPO_CARD_TAG, HerokuRepoCard, type RepoCardData, DeployEvent } from '../components/repo-card/index.js';
import { mapTeamsByEnterpriseAccount } from '../utils/map-teams-by-enterprise.js';
import { mapSpacesByOrganization } from '../utils/map-spaces-by-org.js';
import { GithubService } from './github-service.js';
import elementsButtons from './elements-buttons.json' with { type: 'json' };

type DataPayload = {
  existingApps: App[];
  teams?: Team[];
  spaces?: Space[];
  githubAccessToken?: string;
};

const template = await loadHtmlTemplate(import.meta.resolve('./index.html'));
const styles = (await loadCss([import.meta.resolve('./index.css')])).concat(commonCss);
@customElement({
  name: 'heroku-starter-apps',
  template,
  styles
})

/**
 * A custom web component for displaying and deploying Heroku starter applications.
 *
 * This class extends FASTElement and provides functionality to:
 * - Display reference apps and starter apps from GitHub repositories
 * - Allow searching/filtering of displayed apps
 * - Show app metadata like visibility, language, stars, and last updated date
 * - Enable team and space selection for deployment
 * - Handle the aggregation of data to send to the node process
 * when the user clicks on the "Deploy app" button.
 *
 * Key features:
 * - Integrates with VS Code's webview UI toolkit components
 * - Debounced search filtering
 * - Dynamic creation of repo cards with metadata
 * - Team and space selector dropdowns grouped by enterprise/organization
 * - Loading indicator while data is being fetched
 * - Configuration var input fields when the app.json has `env` entries
 * - Event handling for messages from VS Code extension
 *
 * The component expects an optional DataPayload from the node
 * process containing the following:
 * - teams: Optional array of Heroku teams
 * - spaces: Optional array of Heroku spaces
 */
export class HerokuStarterApps extends FASTElement {
  @shadowChild('#no-results')
  private noResultsElement!: HTMLElement;

  @shadowChild('#reference-apps')
  private referenceAppsUList!: HTMLUListElement;

  @shadowChild('#starter-apps')
  private starterAppsUList!: HTMLUListElement;

  @shadowChild('#heroku-elements-apps')
  private herokuElementsAppsUList!: HTMLElement;

  @shadowChild('#search')
  private searchField!: TextField;

  @shadowChild('#repo-template')
  private repoListItemTemplate!: HTMLTemplateElement;

  @shadowChild('.loading-indicator')
  private loadingIndicator!: ProgressRing;

  private debounceSearch: number | undefined;

  private existingApps: App[] = [];
  private teams: Map<string, Team[]> | undefined;
  private spaces: Map<string, Space[]> | undefined;
  private referenceAppRepos: RepoSearchResultItem[] | undefined;
  private herokuGettingStartedRepos: RepoSearchResultItem[] | undefined;

  private githubService = new GithubService();
  private configVarsByContentsUrl = new Map<string, EnvironmentVariables>();
  private reposRendered = new Map<string, RepoCardData>();

  /**
   * Constructor for the HerokuStarterApps class.
   */
  public constructor() {
    super();
    provideVSCodeDesignSystem().register(vsCodeProgressRing(), vsCodeTextField());
  }

  /**
   * Handler for the deploy event from the repo card.
   * This function is called when the user clicks
   * the "Deploy app" button on a repo card.
   *
   * @param event The deploy event
   */
  private static onDeploy(event: DeployEvent): void {
    vscode.postMessage({ type: 'deploy', payload: event.payload });
  }

  /**
   * @inheritdoc
   */
  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
    this.searchField.addEventListener('input', this.onSearchInput);
    vscode.postMessage({ type: 'connected' });
  }

  /**
   * @inheritdoc
   */
  public disconnectedCallback(): void {
    window.removeEventListener('message', this.onMessage);
  }

  /**
   * Creates the repo card from the template html and
   * hydrates it with the data about the repo.
   *
   * @param item The repository data to create a repo card for
   * @param teams The list of teams the user belongs to
   * @returns A document fragment containing the repo card
   */
  private createRepoCard(item: RepoCardData): DocumentFragment {
    const listElement = this.repoListItemTemplate.content.cloneNode(true) as DocumentFragment;
    (listElement.firstElementChild as HTMLLIElement).id = item.name ?? item.repo_name;
    const card = listElement.querySelector(HEROKU_REPO_CARD_TAG) as HerokuRepoCard;
    // This is required to ensure that the component is rendered,
    // any decorators have fully initialized and the shadow DOM
    // is available before we try to access it.
    requestAnimationFrame(() => {
      card.data = item;
      card.existingApps = this.existingApps;
      card.teams = this.teams;
      card.spaces = this.spaces;
      card.configVarsFetcher = this.configVarsFetcher();
      card.addEventListener(DeployEvent.DEPLOY, HerokuStarterApps.onDeploy);
    });

    return listElement;
  }

  /**
   * Handler for the search input which
   * debounces filtering by 250ms. This
   * timeout is reset each time the user
   * types in the search input.
   */
  private onSearchInput = (): void => {
    clearTimeout(this.debounceSearch);
    this.debounceSearch = setTimeout(this.applyFilter, 250) as unknown as number;
  };

  /**
   * Applies the filter to the list of repos
   * from the user's search input. Elements
   * within the list are hidden if no match is
   * found.
   */
  private applyFilter = (): void => {
    const term = this.searchField.value.toLowerCase();
    // Search these fields
    const fields: Array<keyof RepoCardData> = [
      'name',
      'repo_name',
      'description',
      'public_description',
      'language',
      'html_url',
      'public_repository'
    ];
    let foundCt = 0;
    for (const [id, repo] of this.reposRendered) {
      const matches = fields.some((field) => {
        const value = repo[field]?.toLocaleString().toLocaleLowerCase();
        return value?.includes(term);
      });
      const element = this.shadowRoot!.getElementById(id);
      element?.classList.toggle('hidden', !matches);
      element?.setAttribute('aria-hidden', String(!matches));
      if (matches) {
        foundCt++;
      }
    }
    this.noResultsElement.classList.toggle('hidden', foundCt > 0);
  };

  /**
   * Message receiver for the node process.
   * This function receives the data used to
   * populate the view from the node process.
   *
   * @param event The message event
   */
  private onMessage = (event: MessageEvent<DataPayload>): void => {
    const { existingApps, githubAccessToken, spaces, teams } = event.data;

    this.existingApps = existingApps;
    this.teams = mapTeamsByEnterpriseAccount(teams);
    this.spaces = mapSpacesByOrganization(spaces);
    this.githubService.accessToken = githubAccessToken;

    void (async (): Promise<void> => {
      const [herokuGettingStartedRepoResult, herokuReferenceAppsResult] = await Promise.allSettled([
        this.githubService.searchRepositories({
          q: 'heroku-getting-started',
          sort: 'stars'
        }),
        this.githubService.searchRepositories({
          q: 'user:heroku-reference-apps',
          sort: 'stars'
        })
      ]);

      if (herokuGettingStartedRepoResult.status === 'fulfilled') {
        this.herokuGettingStartedRepos = herokuGettingStartedRepoResult.value?.items.filter((repo) =>
          repo.name.startsWith('heroku-')
        );
      }
      if (herokuReferenceAppsResult.status === 'fulfilled') {
        this.referenceAppRepos = herokuReferenceAppsResult.value?.items;
      }
      this.renderReferenceAppsList();
      this.renderStarterAppsList();
      this.renderHerokuButtonsList();
      this.loadingIndicator.remove();
    })();
  };

  /**
   * Renders the HerokuButtons list
   */
  private renderHerokuButtonsList(): void {
    this.herokuElementsAppsUList.innerHTML = '';

    const herokuElementsAppsReposFragment = document.createDocumentFragment();
    ((elementsButtons as HerokuDeployButton[]) ?? []).forEach((item) => {
      if (this.reposRendered.has(item.repo_name)) {
        return;
      }
      const li = this.createRepoCard(item as RepoCardData);
      herokuElementsAppsReposFragment.appendChild(li);
      this.reposRendered.set(item.repo_name, item as RepoCardData);
    });

    this.herokuElementsAppsUList.appendChild(herokuElementsAppsReposFragment);
  }

  /**
   * Renders the reference apps list.
   */
  private renderReferenceAppsList(): void {
    this.referenceAppsUList.innerHTML = '';

    const referenceAppReposFragment = document.createDocumentFragment();
    (this.referenceAppRepos ?? []).forEach((item) => {
      if (this.reposRendered.has(item.name)) {
        return;
      }
      const li = this.createRepoCard(item as RepoCardData);
      referenceAppReposFragment.appendChild(li);
      this.reposRendered.set(item.name, item as RepoCardData);
    });

    this.referenceAppsUList.appendChild(referenceAppReposFragment);
  }

  /**
   * Renders the starter apps list.
   */
  private renderStarterAppsList(): void {
    this.starterAppsUList.innerHTML = '';

    const herokuGettingStartedReposFragment = document.createDocumentFragment();

    (this.herokuGettingStartedRepos ?? []).forEach((item) => {
      if (this.reposRendered.has(item.name)) {
        return;
      }
      const li = this.createRepoCard(item as RepoCardData);
      herokuGettingStartedReposFragment.appendChild(li);
      this.reposRendered.set(item.name, item as RepoCardData);
    });

    this.starterAppsUList.appendChild(herokuGettingStartedReposFragment);
  }

  private configVarsFetcher =
    () =>
    async (contentsUrl: string): Promise<EnvironmentVariables> => {
      if (this.configVarsByContentsUrl.has(contentsUrl)) {
        return this.configVarsByContentsUrl.get(contentsUrl)!;
      }
      const configVars = await this.githubService.getAppConfigVars(contentsUrl);
      if (!configVars) {
        return {};
      }
      this.configVarsByContentsUrl.set(contentsUrl, configVars);
      return configVars;
    };
}
