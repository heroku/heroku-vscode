import vscode, { type Uri } from 'vscode';
import { HerokuCommand } from '../heroku-command';
import { logExtensionEvent } from '../../utils/logger';

/**
 * Clone a repository from GitHub.
 *
 * @param repoUrl The URL of the repository to clone
 * @returns The URI of the cloned repository or undefined if the user cancelled the operation
 */
export class CloneRepository extends HerokuCommand<Uri | undefined> {
  public static COMMAND_ID = 'heroku:git:clone:repository' as const;

  /**
   * Presents the user with a dialog to select
   * a directory to clone the repo to and then
   * clones the repo using the provided URL argument.
   *
   * @param repoUrl The URL of the repository to clone
   * @returns The URI of the cloned repository or undefined if the user cancelled the operation
   */
  public async run(repoUrl: string): Promise<Uri | undefined> {
    const uris: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select this folder to clone to'
    });

    if (!uris) {
      return;
    }
    const gitProcess = HerokuCommand.exec(`git clone ${repoUrl}`, { cwd: uris[0].fsPath });
    const result = await HerokuCommand.waitForCompletion(gitProcess, {
      sendText: (str: string) => logExtensionEvent(str, 'git')
    });
    if (result.exitCode !== 0) {
      throw new Error(result.errorMessage);
    }
    return uris[0];
  }

  /**
   * Disposes of internal resources and aborts
   * any pending API requests.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
