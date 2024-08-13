import vscode from "vscode";
/**
 * Utility function used to convert WICG import map
 * paths to vscode Uris. This is necessary for any
 * WebView which uses ESM to property import dependencies.
 *
 * @see https://github.com/WICG/import-maps
 *
 * @param webviewView The WebView which will consume the import map.
 * @param imports The object literal containing import paths to convert.
 * @param extensionUri The Uri of the extension initializing the WebView.
 * @returns A newly created object with the converted import paths.
 */
export function convertImportMapPathsToUris<T extends object> (webviewView: vscode.Webview, imports: T, extensionUri: vscode.Uri): T {
  const convertedImports = { ...imports };
  for (const moduleSpecifier in convertedImports) {
    if (!Reflect.has(convertedImports, moduleSpecifier)) {
      continue;
    }
    const moduleEntryPath = convertedImports[moduleSpecifier as keyof T] as string;
    Reflect.set(convertedImports, moduleSpecifier, webviewView.asWebviewUri(vscode.Uri.joinPath(extensionUri, moduleEntryPath)).toString());
  }
  return convertedImports;
}
