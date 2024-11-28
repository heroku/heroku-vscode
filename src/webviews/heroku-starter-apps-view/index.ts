import { customElement, FASTElement } from '@microsoft/fast-element';
import {
  Dropdown,
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeDivider,
  vsCodeTextField,
  vsCodeProgressRing,
  TextField,
  type Button,
  type ProgressRing,
  type Option
} from '@vscode/webview-ui-toolkit';
import type { GithubSearchResponse, RepoSearchResultItem } from 'github-api';
import type { Space, Team } from '@heroku-cli/schema';
import { loadCss, loadHtmlTemplate, vscode } from '../utils.js';
import { shadowChild } from '../meta/shadow-child.js';

type DataPayload = {
  referenceAppRepos: GithubSearchResponse;
  herokuGettingStartedRepos: GithubSearchResponse;
  teams?: Team[];
  spaces?: Space[];
};
const languageToIcon = {
  JavaScript: 'icon-marketing-language-node-48',
  TypeScript: 'icon-marketing-language-node-48',
  NodeJS: 'icon-marketing-language-node-48',
  EJS: 'icon-marketing-language-node-48',
  Python: 'icon-marketing-language-python-48',
  Java: 'icon-marketing-language-java-48',
  PHP: 'icon-marketing-language-php-48',
  Twig: 'icon-marketing-language-php-48',
  Ruby: 'icon-marketing-language-ruby-48',
  Go: 'icon-marketing-language-go-48',
  Gradle: 'icon-marketing-language-gradle-48',
  Scala: 'icon-marketing-language-scala-48',
  Clojure: 'icon-marketing-language-clojure-48'
};
/**
 *
 * @param teams
 * @returns
 */
function mapTeamsByEnterpriseAccount(teams: Team[] = []): Map<string, Team[]> {
  const teamsByEnterpriseAccountName = new Map<string, Team[]>();
  for (const team of teams) {
    const enterpriseName = team.enterprise_account!.name as string;
    const teams = teamsByEnterpriseAccountName.get(enterpriseName) ?? [];
    teams.push(team);
    teamsByEnterpriseAccountName.set(enterpriseName, teams);
  }
  return teamsByEnterpriseAccountName;
}

/**
 *
 * @param spaces
 * @returns
 */
function mapSpacesByOrganization(spaces: Space[] = []): Map<string, Space[]> {
  spaces.sort((a, b) => {
    if (a.shield && b.shield) {
      return a.name.localeCompare(b.name);
    }
    if (a.shield) {
      return -1;
    }
    if (b.shield) {
      return 1;
    }
    return 0;
  });

  const spacesByOrganizationName = new Map<string, Space[]>();
  for (const space of spaces) {
    const organizationName = space.organization.name as string;
    const spaces = spacesByOrganizationName.get(organizationName) ?? [];
    spaces.push(space);
    spacesByOrganizationName.set(organizationName, spaces);
  }
  return spacesByOrganizationName;
}

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
 * A custom web component for displaying and deploying Heroku starter applications.
 *
 * This class extends FASTElement and provides functionality to:
 * - Display reference apps and starter apps from GitHub repositories
 * - Allow searching/filtering of displayed apps
 * - Show app metadata like visibility, language, stars, and last updated date
 * - Enable team and space selection for deployment
 * - Handle the aggregation of data to send to the node process
 * when the user clicks on the "Deploy to Heroku" button.
 *
 * Key features:
 * - Integrates with VS Code's webview UI toolkit components
 * - Debounced search filtering
 * - Dynamic creation of repo cards with metadata provided by the node process
 * - Team and space selector dropdowns grouped by enterprise/organization
 * - Loading indicator while data is being fetched
 * - Event handling for messages from VS Code extension
 *
 * The component expects a DataPayload containing:
 * - referenceAppRepos: GitHub search results for reference applications
 * - herokuGettingStartedRepos: GitHub search results for starter applications
 * - teams: Optional array of Heroku teams
 * - spaces: Optional array of Heroku spaces
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

  @shadowChild('#selector-template')
  private selectorTemplate!: HTMLTemplateElement;

  @shadowChild('#selector-group-template')
  private selectorGroupTemplate!: HTMLTemplateElement;

  @shadowChild('.loading-indicator')
  private loadingIndicator!: ProgressRing;

  private debounceSearch: number | undefined;

  private data: DataPayload | undefined;

  /**
   * Constructor for the HerokuStarterApps class.
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
    teamsByEnterpriseAccountName?: Map<string, Team[]>,
    spacesByOrganizationName?: Map<string, Space[]>
  ): DocumentFragment {
    const listElement = this.repoListItemTemplate.content.cloneNode(true) as DocumentFragment;
    (listElement.firstElementChild as HTMLLIElement).id = item.name;

    // language icon
    const languageIconElement = listElement.querySelector('.language-icon') as HTMLSpanElement;
    languageIconElement.classList.add(
      languageToIcon[item.language as keyof typeof languageToIcon] ?? 'icon-marketing-github-48'
    );

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
    this.createTeamSelector(listElement, teamsByEnterpriseAccountName, item.name);
    // Space selector
    this.createSpaceSelector(listElement, spacesByOrganizationName, item.name);

    // Form for data collection and submission
    const form = listElement.querySelector('form') as HTMLFormElement;
    form.dataset.repoUrl = item.clone_url;
    form.dataset.repoName = item.name;
    form.addEventListener('submit', this.onSubmit);

    // Deploy button delegates to the form.requestSubmit() function
    const deployButton = listElement.querySelector('vscode-button') as Button;
    deployButton.addEventListener('click', () => form.requestSubmit());

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
    const fields: Array<keyof RepoSearchResultItem> = ['name', 'description', 'language', 'html_url'];

    const { herokuGettingStartedRepos = { items: [] }, referenceAppRepos = { items: [] } } = this.data ?? {};
    const allRepos = [...herokuGettingStartedRepos.items, ...referenceAppRepos.items];
    for (const repo of allRepos) {
      const matches = fields.some((field) => {
        const value = repo[field]?.toLocaleString().toLocaleLowerCase();
        return value?.includes(term);
      });
      const element = this.shadowRoot!.getElementById(repo.name);
      element?.classList.toggle('hidden', !matches);
    }
  };

  /**
   * Message receiver for the node process.
   * This function receives the data used to
   * populate the view from the node process.
   *
   * @param event The message event
   */
  private onMessage = (event: MessageEvent<DataPayload>): void => {
    this.data = event.data;
    const { herokuGettingStartedRepos, referenceAppRepos, teams, spaces } = event.data;
    const teamsByEnterpriseAccountName = mapTeamsByEnterpriseAccount(teams);
    const spacesByOrganizationName = mapSpacesByOrganization(spaces);

    const referenceAppReposFragment = document.createDocumentFragment();
    for (const item of referenceAppRepos.items) {
      const listElement = this.createRepoCard(item, teamsByEnterpriseAccountName, spacesByOrganizationName);
      referenceAppReposFragment.appendChild(listElement);
    }
    this.referenceAppsUlist.appendChild(referenceAppReposFragment);

    const herokuGettingStartedReposFragment = document.createDocumentFragment();
    for (const item of herokuGettingStartedRepos.items) {
      const listElement = this.createRepoCard(item, teamsByEnterpriseAccountName, spacesByOrganizationName);
      herokuGettingStartedReposFragment.appendChild(listElement);
    }

    this.starterAppsUlist.appendChild(herokuGettingStartedReposFragment);
    this.loadingIndicator.remove();
  };

  /**
   * Submit handler for the form element containing the
   * team and space selectors.
   *
   * @param event
   */
  private onSubmit(this: HTMLFormElement, event: SubmitEvent): void {
    event.preventDefault();
    const { repoUrl, repoName } = this.dataset;
    const { [0]: teamSelector, [1]: spaceSelector } = (event.target as HTMLFormElement).querySelectorAll<Dropdown>(
      'vscode-dropdown'
    );
    const teamId = teamSelector.value;
    const spaceId = spaceSelector.value;

    vscode.postMessage({ type: 'deploy', payload: { repoUrl, repoName, teamId, spaceId } });
  }

  /**
   * Creates and hydrates the teams selector.
   *
   * @param listElement
   * @param teamsByEnterpriseAccountName
   * @param repoName
   */
  private createTeamSelector(
    listElement: DocumentFragment,
    teamsByEnterpriseAccountName: Map<string, Team[]> | undefined,
    repoName: string
  ): void {
    const teamSelectorContainer = listElement.querySelector('.team-selector-container') as HTMLDivElement;
    if (!teamsByEnterpriseAccountName?.size) {
      teamSelectorContainer.remove();
      return;
    }

    const oldSelector = teamSelectorContainer.querySelector('vscode-dropdown');
    oldSelector?.remove();

    const teamSelectorFragment = this.selectorTemplate.content.cloneNode(true) as DocumentFragment;
    const teamSelector = teamSelectorFragment.firstElementChild as Dropdown;
    // Hydrate the default option
    const defaultOption = teamSelector.querySelector('vscode-option') as Option;
    defaultOption.value = '';
    defaultOption.textContent = 'Personal';

    // Create the root group - this is the "Enterprise Accounts & Teams" top-level group
    teamSelector.append(this.createSelectorGroup('Enterprise Accounts & Teams', 'icon-marketing-enterprise-48'));

    for (const [enterpriseName, teams] of teamsByEnterpriseAccountName) {
      teamSelector.append(this.createSelectorGroup(enterpriseName, 'icon-marketing-enterprise-accounts-48'));

      // options
      for (const team of teams) {
        const option = document.createElement('vscode-option') as Option;
        option.value = team.name;
        option.innerHTML = `<span class="indicator"></span> ${team.name} (${team.role ?? ''})`;
        teamSelector.appendChild(option);
      }
    }
    // proper semantics for the label and the selector
    const teamSelectorLabel = listElement.querySelector('.selector-label') as HTMLLabelElement;
    teamSelectorLabel.htmlFor = `team-selector-${repoName}`;
    teamSelector.id = `team-selector-${repoName}`;

    teamSelector.dataset.repoName = repoName;
    teamSelector.addEventListener('change', this.onTeamSelectorChange);

    teamSelectorContainer.append(teamSelectorFragment);
  }

  /**
   * Creates and hydrates the spaces selector.
   *
   * @param listElement
   * @param teamsByEnterpriseAccountName
   * @param repoName
   */
  private createSpaceSelector(
    listElement: DocumentFragment | HTMLLIElement,
    spacesByEnterpriseAccountName: Map<string, Space[]> | undefined,
    repoName: string,
    selectedTeam?: string
  ): void {
    const spaceSelectorContainer = listElement.querySelector('.space-selector-container') as HTMLDivElement;
    if (!spacesByEnterpriseAccountName?.size) {
      spaceSelectorContainer?.remove();
      return;
    }
    const oldSelector = spaceSelectorContainer.querySelector('vscode-dropdown');
    oldSelector?.remove();

    const spacesSelectorFragment = this.selectorTemplate.content.cloneNode(true) as DocumentFragment;
    const spacesSelector = spacesSelectorFragment.firstElementChild as Dropdown;
    // Hydrate the default option
    const defaultOption = spacesSelector.querySelector('vscode-option') as Option;
    defaultOption.value = '';
    defaultOption.textContent = 'Do not deploy to a space';

    // Create the root group - this is the "Organizations & Spaces" top-level group
    spacesSelector.append(this.createSelectorGroup('Organizations & Spaces', 'icon-marketing-spaces-48'));

    for (const [orgName, spaces] of spacesByEnterpriseAccountName) {
      spacesSelector.append(
        this.createSelectorGroup(orgName, 'icon-marketing-enterprise-48', orgName !== selectedTeam)
      );

      // options for spaces
      for (const space of spaces) {
        const option = document.createElement('vscode-option') as Option;
        option.value = space.id;
        option.innerHTML = `<span class="indicator"></span> ${space.shield ? '<span class="icon icon-space-shielded-16"></span>' : ''} ${space.name}`;
        option.disabled = orgName !== selectedTeam;
        spacesSelector.appendChild(option);
      }
    }
    const spaceSelectorLabel = listElement.querySelector('.selector-label') as HTMLLabelElement;
    spaceSelectorLabel.htmlFor = `space-selector-${repoName}`;
    spacesSelector.id = `space-selector-${repoName}`;

    spaceSelectorContainer.append(spacesSelectorFragment);
  }

  /**
   * Creates a group indicator for use in the vscode Dropdown.
   * This is a visual indicator only and does not contain
   * selectable options.
   *
   * @param labelText The text to use as the group label
   * @param iconCss The CSS class to apply to the icon
   * @returns
   */
  private createSelectorGroup(labelText: string, iconCss: string, disabled = false): DocumentFragment {
    const groupClone = this.selectorGroupTemplate.content.cloneNode(true) as DocumentFragment;
    groupClone.firstElementChild?.classList.toggle('disabled', disabled);
    // label
    const enterpriseLabel = groupClone.querySelector('.label') as HTMLSpanElement;
    enterpriseLabel.textContent = labelText;
    // icon
    const enterpriseIcon = groupClone.querySelector('.icon') as HTMLSpanElement;
    enterpriseIcon.classList.add(iconCss);
    return groupClone;
  }

  /**
   *
   * @param event
   */
  private onTeamSelectorChange = (event: Event): void => {
    const selector = event.target as Dropdown;
    const selectedTeam = selector.value;
    const repoName = selector.dataset.repoName as string;
    const listElement = this.shadowRoot?.getElementById(repoName) as HTMLLIElement | undefined;
    if (!listElement) {
      return;
    }
    const spacesByOrganizationName = mapSpacesByOrganization(this.data!.spaces);
    this.createSpaceSelector(listElement, spacesByOrganizationName, repoName, selectedTeam);
  };
}
