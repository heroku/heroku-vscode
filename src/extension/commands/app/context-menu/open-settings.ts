import * as vscode from 'vscode';
import { App } from '@heroku-cli/schema';
import { herokuCommand, RunnableCommand } from '../../../meta/command';

@herokuCommand()
/**
 * Command to open the app in a browser.
 */
export class OpenAppSettings extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:access-settings' as const;

  /**
   * @inheritdoc
   */
  public async run(app: App): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(`https://dashboard.heroku.com/apps/${app.name}/settings`));
  }

  /**
   * @inheritdoc
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
