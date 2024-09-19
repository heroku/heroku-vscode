import * as vscode from 'vscode';
import { App } from '@heroku-cli/schema';
import { herokuCommand, RunnableCommand } from '../../../meta/command';

@herokuCommand()
/**
 * Command to open the app in a browser.
 */
export class OpenApp extends AbortController implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:open-app' as const;

  /**
   * @inheritdoc
   */
  public async run(app: App): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(app.web_url as string));
  }

  /**
   * @inheritdoc
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
