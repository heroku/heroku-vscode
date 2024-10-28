import type { ChildProcess } from 'node:child_process';
import { exec } from 'node:child_process';

import vscode from 'vscode';
import { RunnableCommand } from '../meta/command';

export type HerokuCommandCompletionInfo = { exitCode: number | string; errorMessage: string; output: string };

/**
 * The HerokuCommand is a base class that can
 * be used when authoring a command that delegates
 * to the Heroku CLI.
 */
export abstract class HerokuCommand<T> extends AbortController implements Disposable, RunnableCommand<T> {
  public static exec: typeof exec = exec;
  protected readonly outputChannel: vscode.OutputChannel | undefined;

  /**
   * Constructs a new HerokuCommand
   *
   * @param outputChannel The optional output channel. This can be used to pipe the Heroku CLI stdout or sdterr messages.
   */
  public constructor(outputChannel?: vscode.OutputChannel) {
    super();
    this.outputChannel = outputChannel;
  }

  /**
   * Waits for the specified child process to complete.
   * Completion is defied as exiting with or without a code
   * or the child process closing whichever is first.
   *
   * @param childProcess The child process to wait on.
   * @param outputChannel The optional output channel. This can be used to pipe the Heroku CLI stdout or sdterr messages.
   * @returns HerokuCommandCompletionInfo
   */
  protected static async waitForCompletion(
    childProcess: ChildProcess,
    outputChannel?: vscode.OutputChannel
  ): Promise<HerokuCommandCompletionInfo> {
    const { default: stripAnsi } = await import('strip-ansi');
    let output = '';
    let errorMessage = '';
    let lastLineReceived = '';
    childProcess.stdout?.addListener('data', (data: string) => {
      const stripped = stripAnsi(data).trim();
      if (!stripped || lastLineReceived === stripped) {
        return;
      }
      outputChannel?.appendLine(stripped);
      output += stripped;
      lastLineReceived = stripped;
    });
    childProcess.stderr?.addListener('data', (data: string) => {
      const stripped = stripAnsi(data).trim();
      if (!stripped || lastLineReceived === stripped) {
        return;
      }
      outputChannel?.appendLine(stripped);
      errorMessage += stripped;
      lastLineReceived = stripped;
    });

    const exitCode = await Promise.race([
      new Promise<number>((resolve) => {
        childProcess.once('exit', (code: number, signal: string) => {
          resolve(code ?? signal);
        });
      }),
      new Promise<number>((resolve) => {
        childProcess.once('close', (code: number, signal: string) => {
          resolve(code ?? signal);
        });
      }),
      new Promise<string>((resolve) => {
        childProcess.once('error', (error: Error) => {
          resolve(error.toString());
        });
      })
    ]);

    return { exitCode, output, errorMessage };
  }

  /**
   * Disposes of any pending API requests or
   * child processes.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }

  public abstract run(...args: unknown[]): T | PromiseLike<T>;
}
