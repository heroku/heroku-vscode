import { customElement, FASTElement } from '@microsoft/fast-element';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeDivider,
  vsCodeTextField,
  vsCodeProgressRing,
  TextField,
  Button,
  ProgressRing,
  Option
} from '@vscode/webview-ui-toolkit';
import type { GithubSearchResponse, RepoSearchResultItem } from 'github-api';
import type { Team } from '@heroku-cli/schema';
import { loadCss, loadHtmlTemplate, vscode } from '../utils.js';
import { shadowChild } from '../meta/shadow-child.js';

type DataPayload = {
  referenceAppRepos: GithubSearchResponse;
  herokuGettingStartedRepos: GithubSearchResponse;
  teams?: Team[];
};

const template = await loadHtmlTemplate(import.meta.resolve('./index.html'));
const styles = await loadCss([
  import.meta.resolve('./index.css'),
  import.meta.resolve('../../../node_modules/@vscode/codicons/dist/codicon.css'),
  import.meta.resolve('../../../resources/hk-malibu/style.css')
]);
@customElement({
  name: 'heroku-starter-apps',
  template,
  styles
})
/**
 *
 */
export class HerokuStarterApps extends FASTElement {
  @shadowChild('#reference-apps')
  private referenceAppsUlist!: HTMLUListElement;

  @shadowChild('#starter-apps')
  private starterAppsUlist!: HTMLUListElement;

  @shadowChild('#search')
  private searchField!: TextField;

  @shadowChild('#repo-template')
  private repoListItemTemplate!: HTMLTemplateElement;

  @shadowChild('.loading-indicator')
  private loadingIndicator!: ProgressRing;

  private debounceSearch: number | undefined;

  private data: DataPayload | undefined;

  /**
   *
   */
  public constructor() {
    super();
    provideVSCodeDesignSystem().register(
      vsCodeDropdown(),
      vsCodeButton(),
      vsCodeOption(),
      vsCodeProgressRing(),
      vsCodeTextField(),
      vsCodeDivider()
    );
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
  private createRepoCard(
    item: RepoSearchResultItem,
    teamsByEnterpriseAccountName?: Map<string, Team[]>
  ): DocumentFragment {
    const listElement = this.repoListItemTemplate.content.cloneNode(true) as DocumentFragment;
    (listElement.firstElementChild as HTMLLIElement).dataset.name = item.name;
    // name
    const repoUrlElement = listElement.querySelector('.repo-url') as HTMLAnchorElement;
    repoUrlElement.href = item.html_url;
    repoUrlElement.textContent = item.name;

    // public/private, etc
    const visibilityElement = listElement.querySelector('.repo-visibility') as HTMLSpanElement;
    visibilityElement.textContent = item.private ? 'Private' : 'Public';

    // description
    const descriptionElement = listElement.querySelector('.repo-description') as HTMLParagraphElement;
    descriptionElement.textContent = item.description ?? 'No description available';

    // meta language
    const languageElement = listElement.querySelector('.meta-item.language') as HTMLSpanElement;
    languageElement.dataset.language = item.language ?? 'other';
    languageElement.textContent = item.language ?? 'Unknown';

    // stars
    const starCountElement = listElement.querySelector('.meta-item .star-count') as HTMLSpanElement;
    starCountElement.textContent = item.stargazers_count.toString();

    // forks
    const forkCountElement = listElement.querySelector('.meta-item .fork-count') as HTMLSpanElement;
    forkCountElement.textContent = item.forks_count.toString();

    // last updated
    const lastUpdatedElement = listElement.querySelector('.meta-item.last-updated') as HTMLSpanElement;
    lastUpdatedElement.textContent = `Last Updated: ${new Date(item.updated_at).toLocaleDateString()}`;

    // Team selector
    const teamSelectorContainer = listElement.querySelector('.team-selector-container') as HTMLDivElement;
    if (teamsByEnterpriseAccountName?.size) {
      const teamSelectorLabel = listElement.querySelector('.team-selector-label') as HTMLLabelElement;
      const teamSelector = teamSelectorContainer.querySelector('.team-selector') as HTMLSelectElement;
      const enterpriseTemplate = listElement.querySelector('.enterprise-template') as HTMLDivElement;

      for (const [enterpriseName, teams] of teamsByEnterpriseAccountName) {
        const enterpriseTemplateClone = enterpriseTemplate.cloneNode(true) as HTMLDivElement;
        // label
        const enterpriseLabel = enterpriseTemplateClone.querySelector('.enterprise-label') as HTMLSpanElement;
        enterpriseLabel.textContent = enterpriseName;
        // icon
        const enterpriseIcon = enterpriseTemplateClone.querySelector('.icon') as HTMLSpanElement;
        enterpriseIcon.classList.replace('icon-marketing-enterprise-accounts-48', 'icon-marketing-enterprise-48');
        teamSelector.append(enterpriseTemplateClone);

        for (const team of teams) {
          const option = document.createElement('vscode-option') as Option;
          option.value = team.id;
          option.innerHTML = `<span class="indicator"></span> ${team.name} (${team.role ?? ''})`;
          teamSelector.appendChild(option);
        }
      }

      teamSelectorLabel.htmlFor = `team-selector-${item.name}`;
      teamSelector.id = `team-selector-${item.name}`;
    } else {
      teamSelectorContainer.remove();
    }

    const deployButton = listElement.querySelector('vscode-button') as Button;
    deployButton.dataset.repoUrl = item.clone_url;
    deployButton.dataset.repoName = item.name;
    // intentionally bound to Button
    deployButton.addEventListener('click', this.onDeployClick);

    return listElement;
  }

  private onSearchInput = (): void => {
    clearTimeout(this.debounceSearch);
    this.debounceSearch = setTimeout(this.applyFilter, 250) as unknown as number;
  };

  private applyFilter = (): void => {
    const term = this.searchField.value.toLowerCase();
    const fields: Array<keyof RepoSearchResultItem> = [
      'name',
      'description',
      'language',
      'html_url',
      'private',
      'stargazers_count',
      'forks_count',
      'updated_at'
    ];

    const { herokuGettingStartedRepos = { items: [] }, referenceAppRepos = { items: [] } } = this.data ?? {};
    const allRepos = [...herokuGettingStartedRepos.items, ...referenceAppRepos.items];
    for (const repo of allRepos) {
      const matches = fields.some((field) => {
        const value = repo[field]?.toLocaleString().toLocaleLowerCase();
        return value?.includes(term);
      });
      const element = this.shadowRoot!.querySelector(`li[data-name="${repo.name}"]`);
      element?.classList.toggle('hidden', !matches);
    }
  };

  /**
   * Message receiver for the node process
   *
   * @param event The message event
   */
  private onMessage = (event: MessageEvent<DataPayload>): void => {
    this.data = event.data;
    const { herokuGettingStartedRepos, referenceAppRepos, teams } = event.data;
    const teamsByEnterpriseAccountName = new Map<string, Team[]>();
    if (teams?.length) {
      for (const team of teams) {
        const enterpriseName = team.enterprise_account!.name as string;
        const teams = teamsByEnterpriseAccountName.get(enterpriseName) ?? [];
        teams.push(team);
        teamsByEnterpriseAccountName.set(enterpriseName, teams);
      }
    }
    const referenceAppReposFragment = document.createDocumentFragment();
    for (const item of referenceAppRepos.items) {
      const listElement = this.createRepoCard(item, teamsByEnterpriseAccountName);
      referenceAppReposFragment.appendChild(listElement);
    }
    this.referenceAppsUlist.appendChild(referenceAppReposFragment);

    const herokuGettingStartedReposFragment = document.createDocumentFragment();
    for (const item of herokuGettingStartedRepos.items) {
      const listElement = this.createRepoCard(item);
      herokuGettingStartedReposFragment.appendChild(listElement);
    }

    this.starterAppsUlist.appendChild(herokuGettingStartedReposFragment);
    this.loadingIndicator.remove();
  };

  /**
   * Click handler for the deploy button
   *
   * @param event
   */
  private onDeployClick(this: Button): void {
    const { repoUrl, repoName } = this.dataset;
    vscode.postMessage({ type: 'deploy', payload: { repoUrl, repoName } });
  }
}
