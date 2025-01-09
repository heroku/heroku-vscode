import { App } from '@heroku-cli/schema';
import { herokuCommand, HerokuOutputChannel, RunnableCommand } from '../../../meta/command';
import { removeRemoteByAppName } from '../../../utils/git-utils';
import { HerokuCommand } from '../../heroku-command';
import { showExtensionLogs } from '../../../utils/logger';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * Command to open the app in a browser.
 */
export class RemoveFromWorkspace extends HerokuCommand<void> implements RunnableCommand<void> {
  public static COMMAND_ID = 'heroku:remove-app-from-workspace' as const;

  /**
   * @inheritdoc
   */
  public async run(app: App): Promise<void> {
    const remoteName = await removeRemoteByAppName(app.name);
    if (remoteName === undefined) {
      showExtensionLogs();
      return;
    }
    this.outputChannel?.show();
    this.outputChannel?.appendLine(`Removed ${app.name} (${remoteName}) from workspace.`);
  }

  /**
   * @inheritdoc
   */
  public [Symbol.dispose](): void {
    this.abort();
  }
}
