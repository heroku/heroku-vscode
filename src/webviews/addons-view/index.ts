import { customElement, FASTElement } from '@microsoft/fast-element';
import {
  Button,
  Dropdown,
  Option,
  ProgressRing,
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeProgressRing
} from '@vscode/webview-ui-toolkit';
import type { AddOn, Plan } from '@heroku-cli/schema';
import { vscode, loadCss, loadHtmlTemplate } from '../utils.js';
import { shadowChild } from '../meta/shadow-child.js';

type AddonCategory = {
  id: number;
  description: string;
  label: string;
  position: number;
  slug: string;
};

type ElementsAddon = {
  category: AddonCategory;
  cli_plugin_name: string;
  icon_url: string;
  id: string;
  name: string;
  provider_terms_url: string;
  slug: string;
  state: string;
  summary: string;
  updated_at: string;
};

type ElementsCategory = AddonCategory & {
  addons: ElementsAddon[];
};

type AddonPlansMessage = { id: string; payload: Plan[] };

const template = await loadHtmlTemplate(import.meta.resolve('./index.html'));
const styles = await loadCss(import.meta.resolve('./index.css'));
@customElement({
  name: 'heroku-add-ons',
  template,
  styles
})
/**
 *
 */
export class HerokuAddOnsMarketplace extends FASTElement {
  @shadowChild('#categories-dropdown')
  private categoryDropdown!: Dropdown;
  @shadowChild('#addons')
  private addonsUlist!: HTMLUListElement;
  private categories: ElementsCategory[] | undefined;
  private installedAddonsByServiceId: Map<string, AddOn> = new Map();
  private listElementByAddonId = new Map<string, HTMLLIElement>();
  private plansById = new Map<string, Plan>();
  private selectedValue: string | undefined;

  /**
   * Constructs a new HerokuAddOnsMarketplace
   */
  public constructor() {
    super();
    provideVSCodeDesignSystem().register(vsCodeDropdown(), vsCodeButton(), vsCodeOption(), vsCodeProgressRing());
  }

  /**
   * @inheritdoc
   */
  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
    vscode.postMessage({ type: 'addons' });
  }

  /**
   * @inheritdoc
   */
  public disconnectedCallback(): void {
    window.removeEventListener('message', this.onMessage);
  }

  /**
   * Populates the sort by category dropdown
   * from the list of categories retrieved earlier
   * in the component lifecycle.
   */
  private prepareCategoryOptions(): void {
    this.categoryDropdown.addEventListener('change', this.setSelectedValue);
    this.categoryDropdown.textContent = '';
    const documentFragment = document.createDocumentFragment();

    const defaultOption = document.createElement('vscode-option') as Option;
    defaultOption.setAttributeNode(document.createAttribute('selected'));
    defaultOption.textContent = 'Show all';
    defaultOption.value = '';
    documentFragment.appendChild(defaultOption);

    const installedOption = document.createElement('vscode-option') as Option;
    installedOption.textContent = 'Installed';
    installedOption.value = 'installed';
    documentFragment.appendChild(installedOption);

    for (const category of this.categories ?? []) {
      const option = document.createElement('vscode-option') as Option;
      option.textContent = category.label;
      option.value = category.id.toString();
      documentFragment.appendChild(option);
    }
    this.categoryDropdown.appendChild(documentFragment);
    requestAnimationFrame(() => (this.categoryDropdown.value = this.selectedValue ?? ''));
  }

  /**
   * Populates the addonsList form the categories
   * retrieved in the connectedCallback.
   *
   * @param addon The addon data to use to create the marketplace card.
   */
  private createAddonsListCard(addon: ElementsAddon): DocumentFragment {
    const listElementTemplate = this.shadowRoot!.getElementById('addon-template') as HTMLTemplateElement;
    const listElement = listElementTemplate.content.cloneNode(true) as DocumentFragment;

    // Targets for addon data
    const logoImg = listElement.querySelector('img') as HTMLImageElement;
    logoImg.src = addon.icon_url;
    logoImg.alt = addon.summary;

    const h2 = listElement.querySelector('h2') as HTMLHeadElement;
    h2.textContent = addon.name;

    const description = listElement.querySelector('span') as HTMLSpanElement;
    description.textContent = addon.summary;

    const installButton = listElement.querySelector('vscode-button') as Button;
    installButton.dataset.addonId = addon.id;
    installButton.addEventListener('click', this.onInstallClick);
    if (this.installedAddonsByServiceId.has(addon.id)) {
      installButton.innerHTML = 'Modify&nbsp;plan';
    }

    return listElement;
  }

  /**
   * Renders the addons list with the provided addons.
   *
   * @param addons The array of addons to populate the addon cards with.
   */
  private renderAddonCards(addons: ElementsAddon[] = []): void {
    this.addonsUlist.textContent = '';
    const documentFragment = document.createDocumentFragment();
    for (const addon of addons) {
      const card = this.createAddonsListCard(addon);
      this.listElementByAddonId.set(addon.id, card.firstElementChild as HTMLLIElement);
      documentFragment.appendChild(card);
    }
    this.addonsUlist.appendChild(documentFragment);
  }

  /**
   * Updates the list of addons based on
   * the category selected from the dropdown.
   *
   * If this method is called programatically,
   * all addons are displayed.
   *
   * @param event The event dispatched by the dropdown.
   */
  private setSelectedValue = (event?: Event): void => {
    if (event) {
      this.selectedValue = (event?.target as Option).value;
    }
    const selectedCategory = parseInt(this.selectedValue ?? 'NaN', 10);

    if (!this.selectedValue) {
      return this.renderAddonCards(this.categories?.map((category) => category.addons).flat());
    }

    if (this.selectedValue === 'installed') {
      const installedElementAddons = this.categories
        ?.map((category) => category.addons)
        .flat()
        .filter((addon) => this.installedAddonsByServiceId.has(addon.id));
      return this.renderAddonCards(installedElementAddons);
    }

    const category = this.categories?.find((category) => category.id === selectedCategory);
    return this.renderAddonCards(category?.addons);
  };

  /**
   * Handler for messages sent by the Node thread.
   *
   * @param event The MessageEvent received from the Node thread.
   */
  private onMessage = (
    event: MessageEvent<{
      type: 'addons' | 'addonPlans' | 'addonCreated' | 'addonCreationFailed';
      payload: unknown;
      id?: string;
    }>
  ): void => {
    const { type } = event.data;

    switch (type) {
      case 'addonPlans':
        {
          this.onAddonPlansMessage(event.data as AddonPlansMessage);
        }
        break;

      case 'addons':
        {
          const { categories, installedAddons } = event.data.payload as {
            categories: ElementsCategory[];
            installedAddons: AddOn[];
          };
          this.onAddonsMessage(categories, installedAddons);
        }
        break;

      case 'addonCreated':
        this.onAddonCreatedMessage(event.data.payload as AddOn);
        break;

      case 'addonCreationFailed':
        this.onAddonCreationFailedMessage(event.data.id as string);
        break;
    }
  };

  /**
   * Shows or hides the progress indicator for
   * the specific addon.
   *
   * @param addonId the id of the addon being targeted.
   * @param show Boolean indicating whether to show the progress indicator.
   */
  private setProgressRingVisibility(addonId: string, show = false): void {
    const card = this.listElementByAddonId.get(addonId);
    const progressRing = card!.querySelector('vscode-progress-ring') as ProgressRing;
    progressRing.style.display = show ? '' : 'none';
  }

  /**
   * Shows or hides the plans dropdown for
   * the specifid addon.
   *
   * @param addonId the id of the addon being targeted.
   * @param show Boolean indicating whether to show the progress indicator.
   */
  private setPlansDropdownVisibility(addonId: string, show = false): Dropdown {
    const plansDropdown = this.getPlansDropdownByAddonId(addonId);
    plansDropdown.style.display = show ? '' : 'none';
    return plansDropdown;
  }

  /**
   * Gets the plans dropdown based on the addon id provided.
   *
   * @param addonId The addonId to get the plans dropdown for.
   * @returns The DropDown instance if found.
   */
  private getPlansDropdownByAddonId(addonId: string): Dropdown {
    const card = this.listElementByAddonId.get(addonId);
    return card!.querySelector('vscode-dropdown') as Dropdown;
  }

  /**
   * Populates the plans dropdown
   *
   * @param addonId The id of the addon to populate the plans dropdown for.
   * @param plans An array of plans offered by the addon vendor.
   */
  private populatePlansDropdown(addonId: string, plans: Plan[]): void {
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    const card = this.listElementByAddonId.get(addonId);
    const documentFragment = document.createDocumentFragment();
    const installedAddon = this.installedAddonsByServiceId.get(addonId);

    const defaultOption = document.createElement('vscode-option') as Option;
    defaultOption.textContent = 'Choose plan';
    defaultOption.value = '';
    documentFragment.appendChild(defaultOption);
    let selectedPlan = '';
    for (const plan of plans) {
      const perMonthMax = currencyFormatter.format(plan.price.cents / 100);
      const perHourCost = currencyFormatter.format(plan.price.cents / 100 / (24 * 30));

      const option = document.createElement('vscode-option') as Option;
      option.textContent = `${plan.human_name} - ${perHourCost} / hour (Max ${perMonthMax}/month)`;
      option.value = plan.id;
      if (installedAddon?.plan.id === plan.id) {
        selectedPlan = plan.id;
      }

      documentFragment.appendChild(option);
      this.plansById.set(plan.id, plan);
    }
    const plansDropdown = card!.querySelector('vscode-dropdown') as Dropdown;
    plansDropdown.textContent = '';
    plansDropdown.dataset.addonId = addonId;
    plansDropdown.appendChild(documentFragment);
    plansDropdown.value = selectedPlan;
  }

  /**
   * Retrieves the install button for the specified addon id.
   *
   * @param addonId The addon id to retrieve the install button for.
   * @returns The Button element.
   */
  private getInstallButtonByAddonId(addonId: string): Button {
    const card = this.listElementByAddonId.get(addonId);
    return card!.querySelector('vscode-button') as Button;
  }

  /**
   * Handler for the addonPlans message received from the Node thread.
   *
   * @param message The message received from the Node thread.
   */
  private onAddonPlansMessage(message: AddonPlansMessage): void {
    const { id: addonId, payload: plans } = message;
    this.populatePlansDropdown(addonId, plans);
    this.setProgressRingVisibility(addonId, false);

    const button = this.getInstallButtonByAddonId(addonId);
    button.removeEventListener('click', this.onInstallClick);
    button.addEventListener('click', this.onSubmitOrUpdate);
    button.textContent = 'Submit';
    button.disabled = true;
    button.appearance = 'primary';

    const plansDropdown = this.setPlansDropdownVisibility(addonId, true);
    plansDropdown.addEventListener('change', this.onPlanChanged);
  }

  /**
   * Event handler for the plans dropdown change.
   *
   * @param event The event dispatched when the plan dropdown changes.
   */
  private onPlanChanged = (event: Event): void => {
    const {
      dataset: { addonId },
      value
    } = event.target as Dropdown;
    const button = this.getInstallButtonByAddonId(addonId as string);
    button.disabled = !value;
  };

  /**
   * Handler for the install button click.
   *
   * @param event The MouseEvent dispatched by the click action.
   */
  private onInstallClick = (event: MouseEvent): void => {
    const {
      dataset: { addonId }
    } = event.target as Button;
    this.setProgressRingVisibility(addonId as string, true);

    vscode.postMessage({ type: 'addonPlans', id: addonId });
  };

  private onSubmitOrUpdate = (event: MouseEvent): void => {
    const {
      dataset: { addonId }
    } = event.target as Button;
    this.setProgressRingVisibility(addonId as string, true);

    const button = this.getInstallButtonByAddonId(addonId as string);
    button.disabled = true;

    const plansDropdown = this.getPlansDropdownByAddonId(addonId as string);
    const plan = this.plansById.get(plansDropdown.value);
    const installedAddon = this.installedAddonsByServiceId.get(addonId as string);
    const type = installedAddon ? 'updateAddon' : 'installAddon';
    vscode.postMessage({ type, id: addonId, plan: plan!.name, installedAddonId: installedAddon?.id });
  };

  /**
   * Handler for the addons message received from the Node thread.
   *
   * @param categories The categories retrieved from the Node thread.
   * @param installedAddons The installed addons retrieved from the Node thread.
   */
  private onAddonsMessage = (categories: ElementsCategory[], installedAddons: AddOn[]): void => {
    this.categories = categories;
    this.installedAddonsByServiceId.clear();
    installedAddons.forEach((addon) => this.installedAddonsByServiceId.set(addon.addon_service.id, addon));
    this.prepareCategoryOptions();
    this.setSelectedValue();
  };

  /**
   * Handler for the addonCreated message received from the Node thread.
   *
   * @param addOn The newly created add on.
   */
  private onAddonCreatedMessage = (addOn: AddOn): void => {
    const button = this.getInstallButtonByAddonId(addOn.addon_service.id);
    button.innerHTML = 'Modify&nbsp;plan';
    button.disabled = false;
    button.appearance = 'secondary';
    button.addEventListener('click', this.onInstallClick);
    button.removeEventListener('click', this.onSubmitOrUpdate);

    this.setProgressRingVisibility(addOn.addon_service.id, false);
    this.setPlansDropdownVisibility(addOn.addon_service.id, false);
    this.installedAddonsByServiceId.set(addOn.addon_service.id, addOn);
  };

  /**
   * Handler for the addonCreationFailed message received from the Node thread.
   *
   * @param addonId The id of the addon that failed to be created.
   */
  private onAddonCreationFailedMessage = (addonId: string): void => {
    this.setProgressRingVisibility(addonId, false);
    const dropdown = this.setPlansDropdownVisibility(addonId, false);
    dropdown.value = '';

    const isInstalledAddon = this.installedAddonsByServiceId.has(addonId);

    const button = this.getInstallButtonByAddonId(addonId);
    button.innerHTML = isInstalledAddon ? 'Modify&nbsp;plan' : 'install';
    button.disabled = false;
    button.appearance = 'secondary';
    button.addEventListener('click', this.onInstallClick);
    button.removeEventListener('click', this.onSubmitOrUpdate);
  };
}
