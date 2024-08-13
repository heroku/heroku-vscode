import vscode, { WebviewPanel } from "vscode";
import { herokuCommand, RunnableCommand } from "../meta/command";
import importMap from '../importmap.json';
import { convertImportMapPathsToUris } from "../utils/import-paths-to-uri";

@herokuCommand()
/**
 * The ShowAddonsViewCommand displays the addons marketplace
 * as a WebView in VSCode
 */
export class ShowAddonsViewCommand extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:addons:show-addons-view' as const;
  private static addonsPanel: WebviewPanel | undefined;
  /**
   * Creates and displays a webview for showing
   * the add-on marketplace
   *
   * @param appIdentifier The application identifier.
   * @param extensionUri The Uri of the extension.
   * @returns Promise<void>
   */
  public run(appIdentifier: string, extensionUri: vscode.Uri): void {
    if (ShowAddonsViewCommand.addonsPanel) {
      try {
        return ShowAddonsViewCommand.addonsPanel.reveal();
      } catch {
        // panel is disposed.
      }
    }

    const panel = vscode.window.createWebviewPanel('Addons', 'Addons', vscode.ViewColumn.One, {enableScripts: true});
    const { webview } = panel;
    const onDiskPath = vscode.Uri.joinPath(extensionUri, 'out/webviews/addons-view', 'index.js');
    const indexPath = webview.asWebviewUri(onDiskPath);
    const webViewImportMap = { ...importMap, imports: convertImportMapPathsToUris(webview, importMap.imports, extensionUri) };

    webview.html = `
    <html style="height: 100%;" lang="en">
    <head>
      <script type="importmap">
      ${JSON.stringify(webViewImportMap)}
      </script>

      <script type="module" src="${indexPath.toString()}"></script>
      <title></title>
    </head>
      <body style="min-height: 100%; display: flex;">
        <heroku-add-ons>Add-on not loaded</heroku-add-ons>
      </body>
    </html>`;

    ShowAddonsViewCommand.addonsPanel = panel;
    void panel.webview.postMessage(appIdentifier);
  }

  /**
   * Disposes of internal resources and aborts
   * any pending API requests.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
