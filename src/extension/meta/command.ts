import vscode from 'vscode';

export type RunnableCommand<T, Args extends unknown[] = unknown[]> = {
  run(...args: Args): T | PromiseLike<T>;
} & AbortController &
  Disposable;

export type RunnableCommandCtor<T = unknown> = {
  COMMAND_ID: string;
  new (outputChannel?: vscode.OutputChannel, context?: vscode.ExtensionContext): RunnableCommand<T>;
};

export type CommandDecoratorConfig = {
  /**
   * The output channel to use for the command.
   */
  outputChannelId: HerokuOutputChannel;
  /**
   * The language ID to use for the output channel.
   * If not provided, the default language ID will be used.
   */
  languageId?: string;
};

export enum HerokuOutputChannel {
  CommandOutput = 'Heroku Command Output',
  LogOutput = 'Heroku Log Output',
  ExtensionDebugLogs = 'Heroku Extension Log Output'
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
  const key = `${outputChannelId}${languageId ?? ''}`;
  let outputChannel = commandOutputChannels.get(key);
  if (!outputChannel) {
    outputChannel = commandOutputChannels
      .set(key, vscode.window.createOutputChannel(outputChannelId, languageId))
      .get(key);
  }
  return outputChannel as vscode.OutputChannel;
}

const registeredCommands = new Set<string>();
let extensionContext: vscode.ExtensionContext;
/**
 * Sets the extension context for the extension.
 * This is used to dispose of the output channels
 * when the extension is deactivated
 * and make the context object available for commands
 *
 * @param context The extension context
 */
export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
  context.subscriptions.push({
    dispose() {
      commandOutputChannels.forEach((channel) => channel.dispose());
    }
  });
}

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
        using runnableCommand = new target(outputChannel, extensionContext);
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
