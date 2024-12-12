import vscode from 'vscode';
// import { visit } from 'jsonc-parser';
import { DeployToHeroku } from '../commands/app/deploy-to-heroku';
/**
 *
 */
export class DeployToHerokuDecorator {
  protected decoration: vscode.TextEditorDecorationType | undefined;

  /**
   * Decorates the app.json file with additional properties
   * and allows the user to deploy the app to Heroku.
   *
   * @param context The extension context
   */
  public maybeDecorate(context: vscode.ExtensionContext): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    const isRootAppJson = workspaceFolders.some(
      (folder) => document.uri.fsPath === vscode.Uri.joinPath(folder.uri, 'app.json').fsPath
    );
    const isRootProcFile = workspaceFolders.some(
      (folder) => document.uri.fsPath === vscode.Uri.joinPath(folder.uri, 'Procfile').fsPath
    );

    if (!isRootAppJson && !isRootProcFile) {
      return;
    }
    const documentWorkspace = workspaceFolders.find((folder) => document.uri.fsPath.startsWith(folder.uri.fsPath));
    const hoverMessage = new vscode.MarkdownString(
      `[$(play) Deploy to Heroku](command:${DeployToHeroku.COMMAND_ID}?${JSON.stringify([null, null, { rootUri: documentWorkspace?.uri }])})`,
      true
    );
    hoverMessage.isTrusted = true;
    const decorationOptions: vscode.DecorationOptions[] = [
      {
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        hoverMessage
      }
    ];

    editor.setDecorations(this.getDecoration(context.extensionUri), decorationOptions);
  }

  /**
   * Disposes of the decoration
   */
  public dispose(): void {
    this.decoration?.dispose();
  }

  /**
   * Gets the decoration
   *
   * @param extensionUri Uri of the extension
   * @returns The decoration
   */
  protected getDecoration(extensionUri: vscode.Uri): vscode.TextEditorDecorationType {
    return (this.decoration ??= vscode.window.createTextEditorDecorationType({
      dark: {
        gutterIconPath: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'logo-mark.svg'),
        gutterIconSize: '.5rem',
        before: {
          contentIconPath: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'deploy.svg'),
          width: '1rem',
          margin: '0 .25rem 0 0'
        }
      },
      gutterIconSize: 'contain',
      gutterIconPath: vscode.Uri.joinPath(extensionUri, 'resources', 'icons', 'malibu', 'dark', 'logo-mark.svg')
    }));
  }
}

/**
 * Activates the deploy to Heroku decorator
 *
 * @param context The extension context
 * @returns A disposable that releases resources and removes listeners
 */
export function activate(context: vscode.ExtensionContext): vscode.Disposable {
  const deployToHerokuDecorator = new DeployToHerokuDecorator();
  /**
   * Change function
   */
  function changeFunction(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId === 'json' || editor?.document.languageId === 'plaintext') {
      deployToHerokuDecorator.maybeDecorate(context);
    }
  }
  const disposables: vscode.Disposable[] = [
    vscode.window.onDidChangeVisibleTextEditors(changeFunction),
    vscode.workspace.onDidChangeTextDocument(changeFunction)
  ];
  changeFunction();

  return {
    dispose(): void {
      deployToHerokuDecorator.dispose();
      disposables.forEach((disposable) => void disposable.dispose());
    }
  };
}
