import vscode from 'vscode';
import importMap from '../importmap.json';
import { convertImportMapPathsToUris } from './import-paths-to-uri';

export type HerokuWebviewPanelOptions = {
  webComponentTag: string;
  viewType: string;
  webviewTitle: string;
  javascriptEntryUri: vscode.Uri;
  localResourceRoots?: vscode.Uri[];
  iconUri?: vscode.Uri;
};

/**
 * Creates and configures a VSCode WebView panel for Heroku-related content
 *
 * @param extensionUri - The URI of the extension's directory
 * @param panelOptions - Configuration options for the webview panel
 * @param panelOptions.webComponentTag - The HTML tag name for the web component to render
 * @param panelOptions.viewType - Unique identifier for the type of webview panel
 * @param panelOptions.webviewTitle - Title displayed in the webview panel's header
 * @param panelOptions.javascriptEntryUri - URI of the JavaScript entry point file
 * @param panelOptions.localResourceRoots - Optional array of URIs that the webview can load resources from
 * @param panelOptions.iconUri - Optional URI for the panel's icon
 *
 * @returns A configured WebviewPanel instance
 *
 * @example
 * const panel = prepareHerokuWebview(context.extensionUri, {
 *   webComponentTag: 'heroku-dashboard',
 *   viewType: 'heroku.dashboard',
 *   webviewTitle: 'Heroku Dashboard',
 *   javascriptEntryUri: vscode.Uri.joinPath(extensionUri, 'out', 'webviews', 'dashboard.js'),
 *   iconUri: vscode.Uri.joinPath(extensionUri, 'resources', 'heroku-icon.svg')
 * });
 */
export function prepareHerokuWebview(
  extensionUri: vscode.Uri,
  panelOptions: HerokuWebviewPanelOptions
): vscode.WebviewPanel {
  const {
    iconUri,
    viewType,
    javascriptEntryUri,
    webComponentTag,
    webviewTitle,
    localResourceRoots = []
  } = panelOptions;
  const options = {
    enableScripts: true,
    localResourceRoots: [
      ...localResourceRoots,
      extensionUri,
      vscode.Uri.joinPath(extensionUri, 'node_modules'),
      vscode.Uri.joinPath(extensionUri, 'out', 'webviews'),
      vscode.Uri.joinPath(extensionUri, 'resources')
    ]
  };
  const panel = vscode.window.createWebviewPanel(viewType, webviewTitle, vscode.ViewColumn.One, options);
  panel.iconPath = iconUri;

  const { webview } = panel;
  const indexPath = webview.asWebviewUri(javascriptEntryUri);
  const webViewImportMap = {
    ...importMap,
    imports: convertImportMapPathsToUris(webview, importMap.imports, extensionUri)
  };
  const malibuIconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'hk-malibu', 'style.css'));
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
  );

  webview.html = `
    <html style="height: 100%;" lang="en">
    <head>
      <script type="importmap">
      ${JSON.stringify(webViewImportMap)}
      </script>

      <script type="module" src="${indexPath.toString()}"></script>
      <title></title>
    </head>
    <link href="${malibuIconsUri.toString()}" rel="stylesheet" />
    <link href="${codiconsUri.toString()}" rel="stylesheet" />
      <body style="min-height: 100%; display: flex; overflow:hidden;">
        <${webComponentTag}>Loading...</${webComponentTag}>
      </body>
    </html>`;
  return panel;
}
