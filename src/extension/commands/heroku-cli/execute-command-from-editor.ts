import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

type CommandOptions = { assignments: string; rawCommand: string; env: NodeJS.ProcessEnv };

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The ExecuteCommandFromEditor class is a command that executes a Heroku CLI command
 * from the active editor. It is used by the ExecuteCommandFromEditorDecorator to
 * provide a visual indicator for Heroku CLI commands in the editor and provide a
 * command to execute the heroku call expressions in the hover text.
 */
export class ExecuteCommandFromEditor extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:execute:from:editor';

  /**
   * Executes the command from the active editor.
   *
   * @param options The command options
   */
  public async run(options: CommandOptions): Promise<void> {
    const { assignments, rawCommand, env } = options;
    this.outputChannel?.show();
    this.outputChannel?.appendLine(`$ ${rawCommand}`);
    const commandProcess = HerokuCommand.exec(`${assignments}${rawCommand}`, { env: { ...process.env, ...env } });
    await HerokuCommand.waitForCompletion(commandProcess, this.outputChannel);
  }
}
