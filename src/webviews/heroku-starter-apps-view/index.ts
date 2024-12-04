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
  vsCodeCheckbox,
  vsCodeLink,
  type TextField,
  type Button,
  type ProgressRing,
  type Option,
  Checkbox
} from '@vscode/webview-ui-toolkit';
import type { GithubSearchResponse, RepoSearchResultItem } from 'github-api';
import type { Space, Team } from '@heroku-cli/schema';
import { EnvironmentVariables } from '@heroku/app-json-schema';
import { loadCss, loadHtmlTemplate, vscode } from '../utils.js';
import { shadowChild } from '../meta/shadow-child.js';
import { GithubService } from './github-service.js';

type DataPayload = {
  teams?: Team[];
  spaces?: Space[];
};

/**
 * Record used to map Heroku marketing icons
 * with the various languages defined in the
 * GitHub repo.
 */
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
 * Maps team by their respective enterprise account names
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
 * Maps spaces by their respective organization names
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

  @shadowChild('#config-var-template')
  private configVarTemplate!: HTMLTemplateElement;

  @shadowChild('.loading-indicator')
  private loadingIndicator!: ProgressRing;

  private debounceSearch: number | undefined;

  private teams: Map<string, Team[]> | undefined;
  private spaces: Map<string, Space[]> | undefined;
  private referenceAppRepos: GithubSearchResponse | undefined;
  private herokuGettingStartedRepos: GithubSearchResponse | undefined;

  private githubService = new GithubService();
  private configVarsByContentsUrl = new Map<string, EnvironmentVariables>();

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
      vsCodeDivider(),
      vsCodeCheckbox(),
      vsCodeLink()
    );
  }

  /**
   * @inheritdoc
   */
  public async connectedCallback(): Promise<void> {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
    this.searchField.addEventListener('input', this.onSearchInput);
    vscode.postMessage({ type: 'connected' });

    this.herokuGettingStartedRepos = await this.githubService.searchRepositories({
      q: 'heroku-getting-started user:heroku',
      sort: 'stars'
    });

    this.referenceAppRepos = await this.githubService.searchRepositories({
      q: 'user:heroku-reference-apps',
      sort: 'stars'
    });
    this.renderReferenceAppsList();
    this.renderStarterAppsList();
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
  private createRepoCard(item: RepoSearchResultItem): DocumentFragment {
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
    this.createTeamSelector(listElement, item.name);
    // Space selector
    this.createSpaceSelector(listElement, item.name);

    // Form for data collection and submission
    const form = listElement.querySelector('form.deploy-options') as HTMLFormElement;
    form.dataset.repoUrl = item.clone_url;
    form.dataset.repoName = item.name;
    form.addEventListener('submit', this.onSubmit);

    // Repo name for configure section
    const repoNameElement = listElement.querySelector('span.repo-name') as HTMLSpanElement;
    repoNameElement.textContent = item.name;

    // Cancel button - only visible when deploy options is expanded - just collapses
    const cancelButton = listElement.querySelector('vscode-button.cancel-button') as Button;
    cancelButton.addEventListener('click', this.onCancelClick);

    // Deploy button - expands the deploy-options for prompts
    const deployButton = listElement.querySelector('vscode-button.deploy-button') as Button;
    deployButton.dataset.contentsUrl = item.contents_url;
    deployButton.addEventListener('click', this.onDeployAppClick);

    return listElement;
  }

  /**
   * Handles the click event on the cancel button
   * and performs the following:
   *
   * 1. Collapses the deployment options form
   * 2. Updates the button text to "Deploy to Heroku"
   * 3. Resets the configuration variables list
   *
   * @param this The vscode-button element where this event originated
   */
  private onCancelClick(this: Button): void {
    const deployOptionsForm = this.closest('form.deploy-options') as HTMLFormElement;
    deployOptionsForm.classList.remove('expanded');

    const deployButton = deployOptionsForm.querySelector('vscode-button.deploy-button') as Button;
    deployButton.lastChild!.textContent = 'Deploy to Heroku';

    const configureUlList = deployOptionsForm.querySelector('ul.configure') as HTMLUListElement;
    const listContainer = deployOptionsForm.querySelector('div.list-container') as HTMLDivElement;
    listContainer.style.overflow = '';
    listContainer.style.height = '';

    listContainer.animate(
      [
        { height: configureUlList.clientHeight + 'px', opacity: 1 },
        { height: '0px', opacity: 0 }
      ],
      {
        duration: 200,
        easing: 'ease-in-out'
      }
    );
  }

  /**
   * Handles the click event on the deploy button to show
   * the config options available for this repo. This function:
   *
   * 1. Fetches application configuration variables from GitHub
   * 2. Expands the deployment options form with an animation
   * 3. Displays configuration variables if they exist
   * 4. Updates the button text and loading state
   *
   * @param event - The MouseEvent triggered by clicking the deploy button
   */
  private onDeployAppClick = (event: MouseEvent): void => {
    const deployButton = event.target as Button;

    const deployOptionsForm = deployButton.closest('form.deploy-options') as HTMLFormElement;
    const configureUlList = deployOptionsForm.querySelector('ul.configure') as HTMLUListElement;

    // The form was expanded and options configured
    // then the user clicked to deploy the app
    if (deployOptionsForm.classList.contains('expanded')) {
      deployOptionsForm.requestSubmit();
      return;
    }

    const { contentsUrl } = deployButton.dataset;
    deployButton.classList.add('loading');

    void (async (): Promise<void> => {
      const configVars =
        this.configVarsByContentsUrl.get(contentsUrl as string) ??
        (await this.githubService.getAppConfigVars(contentsUrl as string)) ??
        {};

      const hasConfigVars = Reflect.ownKeys(configVars).length > 0;
      configureUlList.classList.toggle('has-config-vars', !!hasConfigVars);

      // If we don't have an entry in this.configVarsByContentsUrl
      // we need to build the HTML provided we have config vars
      if (!this.configVarsByContentsUrl.has(contentsUrl as string) && hasConfigVars) {
        this.buildConfigVars(configVars, configureUlList);
      }
      // add an entry so we do not try to fetch config vars
      // or build the HTML a second time.
      this.configVarsByContentsUrl.set(contentsUrl as string, configVars);
      const listContainer = deployOptionsForm.querySelector('div.list-container') as HTMLDivElement;

      const animation = listContainer.animate(
        [
          { height: '0px', opacity: 0 },
          { height: configureUlList.clientHeight + 'px', opacity: 1 }
        ],
        {
          duration: 200,
          easing: 'ease-in-out'
        }
      );
      await new Promise((resolve) => animation.addEventListener('finish', resolve));
      listContainer.style.overflow = 'initial';
      listContainer.style.height = 'initial';
      deployOptionsForm.classList.add('expanded');

      deployButton.classList.remove('loading');
      deployButton.lastChild!.textContent = 'Deploy app';
      listContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })();
  };

  /**
   * Handles the submission of the deployment form.
   * This function prevents the default form submission
   * and instead sends a message to the extension with
   * the form data.
   *
   * @param event - The submit event triggered by the form
   */
  private onSubmit(this: HTMLFormElement, event: SubmitEvent): void {
    event.preventDefault();
    const { repoUrl, repoName } = this.dataset;
    const teamSelector = this.querySelector('vscode-dropdown.team-selector') as Dropdown;
    const spaceSelector = this.querySelector('vscode-dropdown.space-selector') as Dropdown;
    const internalRoutingCheckbox = this.querySelector('[name="internal-routing"]') as Checkbox;

    // config overrides
    const configOverrides = this.querySelectorAll<TextField>('vscode-text-field.config-override');
    const env: EnvironmentVariables = {};
    configOverrides.forEach((configOverride) => {
      const { name, value } = configOverride;
      if (value) {
        env[name] = { value };
      }
    });

    const teamId = teamSelector?.value || undefined;
    const spaceId = spaceSelector?.value ?? undefined;
    vscode.postMessage({
      type: 'deploy',
      payload: {
        repoUrl,
        repoName,
        teamId,
        spaceId,
        internalRouting: internalRoutingCheckbox.checked,
        env
      }
    });
  }

  /**
   * Builds the inputs for the supplied config vars
   * based on the #config-var-template
   *
   * @param configVars The config vars to build form element for
   */
  private buildConfigVars(configVars: EnvironmentVariables, parentElement: HTMLUListElement): void {
    const configKeys = Object.keys(configVars);
    for (const key of configKeys) {
      const configVarTemplate = this.configVarTemplate.content.cloneNode(true) as DocumentFragment;
      const { description, required, value } = configVars[key];

      // required is `true` by default
      // https://devcenter.heroku.com/articles/app-json-schema#env
      const isRequired = required !== false;

      const input = configVarTemplate.querySelector('vscode-text-field') as TextField;
      input.innerHTML = `${key} ${isRequired ? '<span class="required-badge">Required</span>' : ''}`;
      input.name = key;
      input.value = value ?? '';

      const subElement = configVarTemplate.querySelector('sub') as HTMLElement;
      subElement.textContent = description ?? '';

      parentElement.appendChild(configVarTemplate);
    }
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
    const herokuGettingStartedRepos = this.herokuGettingStartedRepos?.items ?? [];
    const referenceAppRepos = this.referenceAppRepos?.items ?? [];
    const allRepos = [...herokuGettingStartedRepos, ...referenceAppRepos];
    for (const repo of allRepos) {
      const matches = fields.some((field) => {
        const value = repo[field]?.toLocaleString().toLocaleLowerCase();
        return value?.includes(term);
      });
      const element = this.shadowRoot!.getElementById(repo.name);
      element?.classList.toggle('hidden', !matches);
      element?.setAttribute('aria-hidden', String(!matches));
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
    this.teams = mapTeamsByEnterpriseAccount(event.data.teams);
    this.spaces = mapSpacesByOrganization(event.data.spaces);

    this.renderReferenceAppsList();
    this.renderStarterAppsList();

    this.loadingIndicator.remove();
  };

  /**
   * Renders the reference apps list.
   */
  private renderReferenceAppsList(): void {
    this.referenceAppsUlist.innerHTML = '';

    const referenceAppReposFragment = document.createDocumentFragment();
    (this.referenceAppRepos?.items ?? []).forEach((item) => {
      const li = this.createRepoCard(item);
      referenceAppReposFragment.appendChild(li);
    });

    this.referenceAppsUlist.appendChild(referenceAppReposFragment);
  }

  /**
   * Renders the starter apps list.
   */
  private renderStarterAppsList(): void {
    this.starterAppsUlist.innerHTML = '';

    const herokuGettingStartedReposFragment = document.createDocumentFragment();

    (this.herokuGettingStartedRepos?.items ?? []).forEach((item) => {
      const li = this.createRepoCard(item);
      herokuGettingStartedReposFragment.appendChild(li);
    });

    this.starterAppsUlist.appendChild(herokuGettingStartedReposFragment);
  }

  /**
   * Creates and hydrates the teams selector.
   *
   * @param listElement
   * @param teamsByEnterpriseAccountName
   * @param repoName
   */
  private createTeamSelector(listElement: DocumentFragment, repoName: string): void {
    const teamSelectorContainer = listElement.querySelector('.team-selector-container') as HTMLDivElement;
    if (!this.teams?.size) {
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

    for (const [enterpriseName, teams] of this.teams) {
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
    teamSelector.classList.add('team-selector');
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
    repoName: string,
    selectedTeam?: string
  ): void {
    const spaceSelectorContainer = listElement.querySelector('li.space-selector-container') as HTMLDivElement;
    const internalRoutingLi = listElement.querySelector('li.internal-routing-container') as HTMLLIElement;
    if (!this.spaces?.size) {
      spaceSelectorContainer?.remove();
      internalRoutingLi?.remove();
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

    for (const [orgName, spaces] of this.spaces) {
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
    spacesSelector.classList.add('space-selector');

    spaceSelectorContainer.append(spacesSelectorFragment);
    spacesSelector.addEventListener('change', this.onSpacesSelectorChange);
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
   * Change handler for the team selector. This handler
   * is responsible for creating the space selector
   * based on the selected team.
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
    this.createSpaceSelector(listElement, repoName, selectedTeam);
  };

  /**
   * Handler for change events dispatched by the spaces selector
   *
   * @param this dropdown bound to this handler
   */
  private onSpacesSelectorChange(this: Dropdown): void {
    const spaceId = this.value;
    const configureUlList = this.closest('ul.configure') as HTMLUListElement;

    const internalRoutingLi = configureUlList.querySelector('li.internal-routing-container') as HTMLLIElement;
    // Always reset this value when a selection changes
    const checkbox = internalRoutingLi.querySelector('vscode-checkbox') as Checkbox;
    checkbox.disabled = !spaceId;
    checkbox.checked = false;
  }
}
