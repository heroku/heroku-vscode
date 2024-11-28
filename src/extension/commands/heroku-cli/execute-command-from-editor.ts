import { herokuCommand } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

export type CommandOptions = { hydratedCommand: string; assignments: string };

@herokuCommand()
/**
 * The ExecuteCommandFromEditor class is a command that executes a Heroku CLI command
 * from the active editor. It is used by the ExecuteCommandFromEditorDecorator to
 * provide a visual indicator for Heroku CLI commands in the editor and provide a
 * command to execute the heroku call expressions in the hover text.
 */
export class ExecuteCommandFromEditor extends HerokuCommandRunner<CommandOptions> {
  public static COMMAND_ID = 'heroku:execute:from:editor' as const;

  /**
   * @inheritdoc
   */
  protected buildCommandShellScript(
    _commandName: string,
    targetDataModel: CommandOptions
  ): Promise<string | undefined> {
    const { hydratedCommand, assignments } = targetDataModel;
    return Promise.resolve(`${assignments}${hydratedCommand}`);
  }

  /**
   * @inheritdoc
   */
  protected hydrateFlags(): PromiseLike<void> | void {
    // no-op
  }
  /**
   * @inheritdoc
   */
  protected hydrateArgs(): PromiseLike<void> | void {
    // no-op
  }
}
