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
  outputChannelId?: HerokuOutputChannel;
};

export enum HerokuOutputChannel {
  Authentication = 'Heroku Authentication',
  CommandOutput = 'Heroku Command Output'
}

const commandOutputChannels = new Map<string, vscode.OutputChannel>();

/**
 * Retrieves the specified output channel
 * or creates one if it does not exist.
 *
 * @param outputChannelId The HerokuOutputChannel to get.
 * @returns The output channel.
 */
export function getOutputChannel(outputChannelId: HerokuOutputChannel): vscode.OutputChannel {
  let outputChannel = commandOutputChannels.get(outputChannelId);
  if (!outputChannel) {
    outputChannel = commandOutputChannels
      .set(outputChannelId, vscode.window.createOutputChannel(outputChannelId))
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
      let outputChannel: vscode.OutputChannel | undefined;
      if (config?.outputChannelId) {
        outputChannel = getOutputChannel(config.outputChannelId);
      }

      vscode.commands.registerCommand(target.COMMAND_ID, async (...args: unknown[]): Promise<unknown> => {
        using runnableCommand = new target(outputChannel);
        return await (runnableCommand.run(...args) as Promise<unknown>);
      });
      registeredCommands.add(target.COMMAND_ID);
    });
  };
}
