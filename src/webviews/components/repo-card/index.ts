import { customElement, FASTElement } from '@microsoft/fast-element';
import {
  type Button,
  type Checkbox,
  type Dropdown,
  type Option,
  provideVSCodeDesignSystem,
  type TextField,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeDivider,
  vsCodeDropdown,
  vsCodeLink,
  vsCodeOption,
  vsCodeProgressRing,
  vsCodeTextField
} from '@vscode/webview-ui-toolkit';
import { RepoSearchResultItem } from 'github-api';
import { HerokuDeployButton } from '@heroku/elements';
import type { App, Space, Team } from '@heroku-cli/schema';
import type { EnvironmentVariables } from '@heroku/app-json-schema';
import type { DeployPayload } from '@heroku/repo-card';
import { commonCss, loadCss, loadHtmlTemplate } from '../../utils/web-component-utils.js';
import { shadowChild } from '../../meta/shadow-child.js';
import { observable } from '../../meta/observable.js';

export type RepoCardData = RepoSearchResultItem & HerokuDeployButton;

export type RepoCardEventMap = {
  [DeployEvent.DEPLOY]: DeployEvent;
} & HTMLElementEventMap;

/**
 * Record used to map Heroku marketing icons
 * with the various languages defined in the
 * GitHub repo.
 */
const languageToIcon = {
  Dockerfile: 'icon-marketing-docker-48',
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
export const HEROKU_REPO_CARD_TAG = 'heroku-repo-card';

const template = await loadHtmlTemplate(import.meta.resolve('./index.html'));
const styles = (await loadCss([import.meta.resolve('./index.css')])).concat(commonCss);
@customElement({
  name: HEROKU_REPO_CARD_TAG,
  template,
  styles
})

/**
 * A web component that renders a GitHub repository card with Heroku deployment options.
 * This component extends FASTElement and provides an interactive interface for viewing
 * repository details and configuring Heroku deployments.
 *
 * @class HerokuRepoCard
 * @extends {FASTElement}
 *
 * @property {RepoCardData | undefined} data - Repository data containing GitHub and Heroku deployment information
 * @property {Map<string, Team[]> | undefined} teams - Map of team configurations grouped by enterprise account
 * @property {Map<string, Space[]> | undefined} spaces - Map of available Heroku spaces grouped by team
 * @property {(contentsUrl: string) => Promise<EnvironmentVariables> | EnvironmentVariables} [configVarsFetcher] - Optional function to fetch environment variables
 *
 * @fires {RepoCardEvent} RepoCardEvent.DEPLOY - Fired when a deployment is initiated
 *
 * @example
 * ```html
 * <heroku-repo-card>
 *   <!-- Card content will be rendered here -->
 * </heroku-repo-card>
 * ```
 *
 * Features:
 * - Displays repository metadata (language, stars, forks, last updated)
 * - Shows repository visibility status (public/private)
 * - Provides deployment configuration options
 * - Supports team and space selection
 * - Handles environment variable configuration
 * - Integrates with VS Code's webview UI toolkit
 *
 * The component automatically registers required VS Code webview UI toolkit components
 * and handles all necessary event listeners for form submission and user interactions.
 */
export class HerokuRepoCard extends FASTElement {
  @observable('dataChanged')
  public data: RepoCardData | undefined;

  @observable('teamsChanged')
  public teams: Map<string, Team[]> | undefined;

  @observable('spacesChanged')
  public spaces: Map<string, Space[]> | undefined;

  @shadowChild('.language-icon')
  protected languageIcon!: HTMLSpanElement;

  @shadowChild('.repo-url')
  protected repoUrl!: HTMLAnchorElement;

  @shadowChild('.repo-visibility')
  protected repoVisibility!: HTMLSpanElement;

  @shadowChild('.repo-description')
  protected repoDescription!: HTMLParagraphElement;

  @shadowChild('.meta-item.language')
  protected metaItemLanguage!: HTMLSpanElement;

  @shadowChild('.meta-item .star-count')
  protected metaItemStarCount!: HTMLSpanElement;

  @shadowChild('.meta-item .fork-count')
  protected metaItemForkCount!: HTMLSpanElement;

  @shadowChild('.meta-item.last-updated')
  protected metaItemLastUpdated!: HTMLSpanElement;

  @shadowChild('form.deploy-options')
  protected deployOptionsForm!: HTMLFormElement;

  @shadowChild('span.repo-name')
  protected repoName!: HTMLSpanElement;

  @shadowChild('vscode-button.cancel-button')
  protected cancelButton!: Button;

  @shadowChild('vscode-button.deploy-button')
  protected deployButton!: Button;

  @shadowChild('.team-selector-container')
  protected teamSelectorContainer!: HTMLDivElement;

  @shadowChild('.space-selector-container')
  protected spaceSelectorContainer!: HTMLDivElement;

  @shadowChild('internal-routing-container')
  protected internalRoutingContainer!: HTMLDivElement;

  @shadowChild('.configure')
  protected configureUlList!: HTMLUListElement;

  @shadowChild('vscode-text-field.app-name')
  protected appNameTextField!: TextField;

  @shadowChild('#selector-template')
  private selectorTemplate!: HTMLTemplateElement;

  @shadowChild('#selector-group-template')
  private selectorGroupTemplate!: HTMLTemplateElement;

  @shadowChild('#config-var-template')
  private configVarTemplate!: HTMLTemplateElement;

  public configVarsFetcher?: (contentsUrl: string) => Promise<EnvironmentVariables> | EnvironmentVariables;
  public existingApps: App[] | undefined;

  /**
   * @inheritdoc
   */
  public declare addEventListener: <K extends keyof RepoCardEventMap>(
    type: K,
    listener: (this: HerokuRepoCard, ev: RepoCardEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ) => ReturnType<typeof HTMLElement.prototype.addEventListener>;

  /**
   * @inheritdoc
   */
  public declare removeEventListener: <K extends keyof RepoCardEventMap>(
    type: K,
    listener: (this: HerokuRepoCard, ev: RepoCardEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ) => ReturnType<typeof HTMLElement.prototype.removeEventListener>;

  /**
   * @inheritdoc
   */
  public declare dispatchEvent: <K extends keyof RepoCardEventMap>(
    ev: RepoCardEventMap[K]
  ) => ReturnType<typeof HTMLElement.prototype.dispatchEvent>;

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
  public connectedCallback(): void {
    super.connectedCallback();
    this.appNameTextField.addEventListener('input', this.onAppNameInput);
  }

  /**
   * Change handler for the data property.
   *
   * @param value The value to set the data property to
   */
  protected dataChanged(): void {
    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Change handler for the spaces property.
   *
   * @param value The value to set the spaces property to
   */
  protected spacesChanged(): void {
    this.renderSpaceSelector();
  }

  /**
   * Change handler for the teams property.
   *
   * @param value The value to set the teams property to
   */
  protected teamsChanged(): void {
    this.renderTeamSelector();
  }

  /**
   * Renders the component based on the data.
   */
  private render(): void {
    if (!this.data) {
      return;
    }
    const item = this.data;
    // language icon
    this.languageIcon.classList.add(
      languageToIcon[item.language as keyof typeof languageToIcon] ?? 'icon-marketing-github-48'
    );

    // name
    this.repoUrl.href = item.html_url ?? item.public_repository;
    this.repoUrl.textContent = item.name ?? item.repo_name;

    // public/private, etc
    this.repoVisibility.textContent = item.private ? 'Private' : 'Public';

    // description
    this.repoDescription.textContent = item.description ?? item.public_description ?? 'No description available';

    this.metaItemLanguage.dataset.language = item.language ?? 'unknown';
    this.metaItemLanguage.textContent = item.language ?? 'Unknown';
    // stars
    this.metaItemStarCount.textContent = (item.stargazers_count ?? item.stars ?? '').toString();

    // forks
    this.metaItemForkCount.textContent = (item.forks_count ?? item.forks ?? '').toString();

    // last updated
    this.metaItemLastUpdated.textContent = `Last Updated: ${new Date(item.updated_at ?? Date.now()).toLocaleDateString()}`;

    // Form for data collection and submission
    this.deployOptionsForm.dataset.repoUrl = item.clone_url ?? `${item.public_repository}.git`;
    this.deployOptionsForm.dataset.repoName = item.name ?? item.repo_name;
    this.deployOptionsForm.addEventListener('submit', this.onSubmit);

    // Repo name for configure section
    this.repoName.textContent = item.name ?? item.repo_name;

    // Cancel button - only visible when deploy options is expanded - just collapses
    this.cancelButton.addEventListener('click', this.onCancelClick);

    // Deploy button - expands the deploy-options for prompts
    this.deployButton.addEventListener('click', this.onDeployAppClick);
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
   * Creates and hydrates the teams selector.
   *
   * @param teamsByEnterpriseAccountName
   * @param repoName
   */
  private renderTeamSelector(): void {
    this.teamSelectorContainer.classList.toggle('hidden', !this.teams?.size);
    if (!this.teams?.size) {
      return;
    }

    const oldSelector = this.teamSelectorContainer.querySelector('vscode-dropdown');
    oldSelector?.remove();

    const teamSelectorFragment = this.selectorTemplate.content.cloneNode(true) as DocumentFragment;
    const teamSelector = teamSelectorFragment.firstElementChild as Dropdown;
    teamSelector.setAttribute('aria-label', 'Select a team');
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
    const repoName = this.data?.name ?? this.data?.repo_name;
    const teamSelectorLabel = this.teamSelectorContainer.querySelector('.selector-label') as HTMLLabelElement;
    teamSelectorLabel.htmlFor = `team-selector-${repoName}`;
    teamSelector.id = `team-selector-${repoName}`;

    teamSelector.dataset.repoName = repoName;
    teamSelector.classList.add('team-selector');
    teamSelector.addEventListener('change', this.onTeamSelectorChange);

    this.teamSelectorContainer.append(teamSelectorFragment);
  }

  /**
   * Creates and hydrates the spaces selector.
   *
   * @param listElement
   * @param teamsByEnterpriseAccountName
   * @param repoName
   */
  private renderSpaceSelector(selectedTeam?: string): void {
    if (!this.spaces?.size) {
      this.spaceSelectorContainer?.remove();
      this.internalRoutingContainer?.remove();
      return;
    }
    const oldSelector = this.spaceSelectorContainer.querySelector('vscode-dropdown');
    oldSelector?.remove();

    const spacesSelectorFragment = this.selectorTemplate.content.cloneNode(true) as DocumentFragment;
    const spacesSelector = spacesSelectorFragment.firstElementChild as Dropdown;
    spacesSelector.setAttribute('aria-label', 'Select a space');

    // Hydrate the default option
    const defaultOption = spacesSelector.querySelector('vscode-option') as Option;
    defaultOption.value = '';
    defaultOption.textContent = '-- none --';

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
    const repoName = this.data?.name ?? this.data?.repo_name;
    const spaceSelectorLabel = this.spaceSelectorContainer.querySelector('.selector-label') as HTMLLabelElement;
    spaceSelectorLabel.htmlFor = `space-selector-${repoName}`;
    spacesSelector.id = `space-selector-${repoName}`;
    spacesSelector.classList.add('space-selector');

    this.spaceSelectorContainer.append(spacesSelectorFragment);
    spacesSelector.addEventListener('change', this.onSpacesSelectorChange);
  }

  /**
   * Builds the inputs for the supplied config vars
   * based on the #config-var-template
   *
   * @param configVars The config vars to build form element for
   */
  private async renderConfigVars(): Promise<void> {
    const oldConfigVars = this.configureUlList.querySelectorAll('.config-var');
    oldConfigVars.forEach((el) => el.remove());

    // wait for the config vars to be retrieved
    const contentsUrl =
      this.data?.contents_url ??
      `https://api.github.com/repos/${this.data?.public_username}/${this.data?.repo_name}/contents/{+path}`;
    const configVars = (await this.configVarsFetcher?.(contentsUrl)) ?? {};
    const configKeys = Object.keys(configVars);
    this.configureUlList.classList.toggle('has-config-vars', !!configKeys.length);
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

      this.configureUlList.appendChild(configVarTemplate);
    }
  }

  /**
   * Handler for the app name input. This sends
   * an IPC message to the node process to validate
   * the value.
   *
   * @param event Event dispatched by the text field
   */
  private onAppNameInput = (event: Event): void => {
    const { value } = event.target as TextField;
    const match = !!this.existingApps?.some((app) => app.name === value);

    this.appNameTextField.setAttribute('aria-invalid', String(!!match));
    const err = match ? 'The app name is not available' : '';
    const flags = match ? { customError: true } : {};
    this.appNameTextField.setValidity(flags, err);
    this.deployButton.disabled = match;
    this.deployOptionsForm.checkValidity();

    // update the validation message
    const validationMessageSpan = this.shadowRoot!.querySelector(
      'li.app-name sub.validation-message'
    ) as HTMLSpanElement;
    validationMessageSpan.textContent = match
      ? err
      : "We'll pick one for you if this field is left blank. You can change it later.";
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
    this.renderSpaceSelector(selectedTeam);
  };

  /**
   * Handles the submission of the deployment form.
   * This function prevents the default form submission
   * and instead sends a message to the extension with
   * the form data.
   *
   * @param event - The submit event triggered by the form
   */
  private onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const { repoUrl, repoName } = this.deployOptionsForm.dataset;
    const teamSelector = this.deployOptionsForm.querySelector('vscode-dropdown.team-selector') as Dropdown;
    const spaceSelector = this.deployOptionsForm.querySelector('vscode-dropdown.space-selector') as Dropdown;
    const internalRoutingCheckbox = this.deployOptionsForm.querySelector('[name="internal-routing"]') as Checkbox;

    // config overrides
    const configOverrides = this.deployOptionsForm.querySelectorAll<TextField>('vscode-text-field.config-override');
    const env: EnvironmentVariables = {};
    configOverrides.forEach((configOverride) => {
      const { name, value } = configOverride;
      if (value) {
        env[name] = { value };
      }
    });

    const teamId = teamSelector?.value || undefined;
    const spaceId = spaceSelector?.value || undefined;
    const appName = this.appNameTextField.value || undefined;

    this.dispatchEvent(
      new DeployEvent({
        appName,
        repoUrl,
        repoName,
        teamId,
        spaceId,
        internalRouting: internalRoutingCheckbox.checked,
        env
      })
    );
  };

  /**
   * Handles the click event on the cancel button
   * and performs the following:
   *
   * 1. Collapses the deployment options form
   * 2. Updates the button text to "Deploy to Heroku"
   * 3. Resets the configuration variables list
   *
   * @param event event dispatched by the click
   */
  private onCancelClick = (): void => {
    this.classList.remove('expanded');

    this.deployButton.lastChild!.textContent = 'Deploy to Heroku';
    this.deployButton.disabled = false;
    this.appNameTextField.value = '';
    this.appNameTextField.removeAttribute('aria-invalid');
    this.appNameTextField.setValidity({});

    const configureUlList = this.deployOptionsForm.querySelector('ul.configure') as HTMLUListElement;
    const listContainer = this.deployOptionsForm.querySelector('div.list-container') as HTMLDivElement;
    listContainer.style.overflow = '';
    listContainer.style.height = '';

    void (async (): Promise<void> => {
      const animation = listContainer.animate(
        [
          { height: configureUlList.clientHeight + 'px', opacity: 1 },
          { height: '0px', opacity: 0 }
        ],
        {
          duration: 200,
          easing: 'ease-in-out'
        }
      );
      await animation.finished;
      // restore the hover state on collapsed rows
      this.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })();
  };

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
  private onDeployAppClick = (): void => {
    // The form was expanded and options configured
    // then the user clicked to deploy the app
    if (this.classList.contains('expanded')) {
      this.deployOptionsForm.requestSubmit();
      return;
    }

    this.deployButton.classList.add('loading');

    // retrieves the config vars from the app.json
    // in the repo, builds the inputs, animates
    // the expansion of the form and scrolls it into view
    void (async (): Promise<void> => {
      await this.renderConfigVars();
      const listContainer = this.deployOptionsForm.querySelector('div.list-container') as HTMLDivElement;

      const animation = listContainer.animate(
        [
          { height: '0px', opacity: 0 },
          { height: this.configureUlList.clientHeight + 'px', opacity: 1 }
        ],
        {
          duration: 200,
          easing: 'ease-in-out'
        }
      );

      await animation.finished;
      listContainer.style.overflow = 'initial';
      listContainer.style.height = 'initial';
      this.classList.add('expanded');

      this.deployButton.classList.remove('loading');
      this.deployButton.lastChild!.textContent = 'Deploy app';
      this.appNameTextField.focus();
      this.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })();
  };
}

/**
 * Event dispatched when the user clicks the deploy button
 */
export class DeployEvent extends Event {
  public static DEPLOY = 'deploy' as const;

  /**
   * Constructs a new DeployEvent instance with the provided payload.
   *
   * @param payload The payload to deploy to Heroku
   */
  public constructor(public readonly payload: DeployPayload) {
    super(DeployEvent.DEPLOY);
  }
}
