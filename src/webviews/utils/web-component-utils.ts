import type { ElementViewTemplate, ComposableStyles } from '@microsoft/fast-element';
import { css, html } from '@microsoft/fast-element';

/**
 * Common css used in most custom web components.
 * Using to avoid duplication of css in each component.
 * Also used to load the codicon css.
 *
 * Note that these paths are relative to the `out/` directory
 * and not the `src/` directory.
 */
export const commonCss = await loadCss([
  import.meta.resolve('../../../node_modules/@vscode/codicons/dist/codicon.css'),
  import.meta.resolve('../../../resources/hk-malibu/style.css')
]);

/**
 * Loads the specified html from a file and
 * returns the ElementViewTemplate for
 * use in a FastElement decorator.
 *
 * @param templatePath The path to the HTML template.
 * @returns a promise that resolves to the ElementViewTemplate.
 */
export async function loadHtmlTemplate(templatePath: string): Promise<ElementViewTemplate> {
  try {
    const templateResult = await fetch(templatePath);
    if (templateResult.ok) {
      return html`${await templateResult.text()}`;
    }
  } catch {
    // no-op
  }
  return html`Could not load template`;
}

/**
 * Loads the specified css from a file and
 * returns an array of ComposableStyles for
 * use in a FastElement decorator.
 *
 * @param cssPath Either a single string or an array of strings representing the path to the css file
 * @returns An array of ComposableStyles
 */
export async function loadCss(cssPath: string | string[]): Promise<ComposableStyles[]> {
  const cssPaths = Array.isArray(cssPath) ? cssPath : [cssPath];
  const requests = cssPaths.map((path) => fetch(path));
  const results = await Promise.allSettled(requests);
  const cssResults = await Promise.all(
    results.filter((result) => result.status === 'fulfilled').map((fulfilled) => fulfilled.value.text())
  );

  return cssResults.map(
    (cssText) => css`
      ${cssText}
    `
  );
}

export const vscode = acquireVsCodeApi();
