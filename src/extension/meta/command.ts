import vscode from 'vscode';

export type RunnableCommand<T, Args extends unknown[] = unknown[]> = {
  run(...args: Args): T | PromiseLike<T>;
} & AbortController &
  Disposable;

export type RunnableCommandCtor<T = unknown> = {
  COMMAND_ID: string;
  new (outputChannel?: vscode.OutputChannel): RunnableCommand<T>;
};

export type CommandDecoratorConfig = {
  outputChannelId: HerokuOutputChannel;
  languageId?: string;
};

export enum HerokuOutputChannel {
  Authentication = 'Heroku Authentication',
  CommandOutput = 'Heroku Command Output',
  LogOutput = 'Heroku Log Output'
}

const commandOutputChannels = new Map<string, vscode.OutputChannel>();

/**
 * Retrieves the specified output channel
 * or creates one if it does not exist.
 *
 * @param config The CommandDecoratorConfig to use
 * @returns The output channel.
 */
export function getOutputChannel(config?: CommandDecoratorConfig | undefined): vscode.OutputChannel | undefined {
  if (!hasOutputChannelId(config)) {
    return;
  }
  const { outputChannelId, languageId } = config;
  let outputChannel = commandOutputChannels.get(outputChannelId as string);
  if (!outputChannel) {
    outputChannel = commandOutputChannels
      .set(outputChannelId, vscode.window.createOutputChannel(outputChannelId, languageId))
      .get(outputChannelId);
  }
  return outputChannel as vscode.OutputChannel;
}

const registeredCommands = new Set<string>();

/**
 * Decorator for registering VSCode commands.
 *
 * @param config The CommandDecoratorConfig object containing configuration options
 * @returns A decorator function.
 */
export function herokuCommand<const C extends RunnableCommandCtor>(config?: CommandDecoratorConfig) {
  return function (target: C, context: ClassDecoratorContext): void {
    context.addInitializer(() => {
      if (registeredCommands.has(target.COMMAND_ID)) {
        process.stderr.write(`${target.COMMAND_ID} already registered.`);
        return;
      }

      vscode.commands.registerCommand(target.COMMAND_ID, async (...args: unknown[]): Promise<unknown> => {
        const outputChannel = getOutputChannel(config);
        using runnableCommand = new target(outputChannel);
        return await (runnableCommand.run(...args) as Promise<unknown>);
      });
      registeredCommands.add(target.COMMAND_ID);
    });
  };
}

/**
 * Checks the provided config for the presence of an outputChannelId
 *
 * @param config The config to check for an outputChannelId
 * @returns boolean
 */
function hasOutputChannelId(
  config: CommandDecoratorConfig | undefined
): config is { outputChannelId: HerokuOutputChannel; languageId?: string } {
  return !!(config && 'outputChannelId' in config);
}
