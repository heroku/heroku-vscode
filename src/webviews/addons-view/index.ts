import { customElement, FASTElement } from "@microsoft/fast-element";
import { provideVSCodeDesignSystem, vsCodeTextField, vsCodeButton, vsCodeCheckbox } from "@vscode/webview-ui-toolkit";
import { loadCss, loadHtmlTemplate } from "../utils.js";

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
  /**
   * Constructs a new HerokuAddOnsMarketplace
   */
  public constructor() {
    super();
    provideVSCodeDesignSystem().register(vsCodeTextField(), vsCodeButton(), vsCodeCheckbox());
  }
}
