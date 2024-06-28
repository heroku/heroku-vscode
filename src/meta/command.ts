import vscode from 'vscode';

export interface RunnableCommand<T, Args extends unknown[] = unknown[]> extends AbortController, Disposable {
  run(...args: Args): T | PromiseLike<T>;
}

export interface RunnableCommandCtor<T = unknown> {
  COMMAND_ID: string;
  new (outputChannel?: vscode.OutputChannel): RunnableCommand<T>;
}

export function herokuCommand<const C extends RunnableCommandCtor>(target: C, context: ClassDecoratorContext): void {
  context.addInitializer(() => {
    vscode.commands.registerCommand(
      target.COMMAND_ID,
      async (outputChannel?: vscode.OutputChannel, ...args: unknown[]) => {
        using runnableCommand = new target(outputChannel);
        const result = await runnableCommand.run(...args);
        return result;
      }
    );
  });
}
