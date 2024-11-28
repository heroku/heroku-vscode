import { customElement, FASTElement } from '@microsoft/fast-element';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
  vsCodeProgressRing,
  TextField,
  Button
} from '@vscode/webview-ui-toolkit';
import type { GithubSearchResponse, RepoSearchResultItem } from 'github-api';
import { loadCss, loadHtmlTemplate, vscode } from '../utils.js';
import { shadowChild } from '../meta/shadow-child.js';

type RepositoriesPayload = { referenceAppRepos: GithubSearchResponse; herokuGettingStartedRepos: GithubSearchResponse };

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

  private debounceSearch: number | undefined;

  private repos: RepositoriesPayload | undefined;

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
      vsCodeTextField()
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
   */
  private createRepoCard(item: RepoSearchResultItem): DocumentFragment {
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

    const deployButton = listElement.querySelector('vscode-button') as Button;
    deployButton.dataset.repoUrl = item.clone_url;
    deployButton.dataset.repoName = item.name;
    // intentionally bound to Button
    deployButton.addEventListener('click', this.onDeployClick);

    return listElement;
  }

  private onSearchInput = (): void => {
    const { value } = this.searchField;
    clearTimeout(this.debounceSearch);
    this.debounceSearch = setTimeout(this.applyFilter, 250) as unknown as number;
  };

  private applyFilter = (): void => {
    const term = this.searchField.value.toLowerCase();
    const fields: (keyof RepoSearchResultItem)[] = [
      'name',
      'description',
      'language',
      'html_url',
      'private',
      'stargazers_count',
      'forks_count',
      'updated_at'
    ];

    const { herokuGettingStartedRepos = { items: [] }, referenceAppRepos = { items: [] } } = this.repos ?? {};
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
  private onMessage = (event: MessageEvent<RepositoriesPayload>): void => {
    this.repos = event.data;
    const { herokuGettingStartedRepos, referenceAppRepos } = event.data;

    const referenceAppReposFragment = document.createDocumentFragment();
    for (const item of referenceAppRepos.items) {
      const listElement = this.createRepoCard(item);
      referenceAppReposFragment.appendChild(listElement);
    }
    this.referenceAppsUlist.appendChild(referenceAppReposFragment);

    const herokuGettingStartedReposFragment = document.createDocumentFragment();
    for (const item of herokuGettingStartedRepos.items) {
      const listElement = this.createRepoCard(item);
      herokuGettingStartedReposFragment.appendChild(listElement);
    }

    this.starterAppsUlist.appendChild(herokuGettingStartedReposFragment);
  };

  /**
   * Click handler for the deploy button
   *
   * @param event
   */
  private onDeployClick(this: Button): void {
    const { repoUrl } = this.dataset;
    vscode.postMessage({ type: 'deploy', payload: repoUrl });
  }
}
