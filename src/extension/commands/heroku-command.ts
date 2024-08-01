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
   * @returns HerokuCommandCompletionInfo
   */
  protected static async waitForCompletion(
    childProcess: ChildProcess
  ): Promise<HerokuCommandCompletionInfo> {
    let output = '';
    let errorMessage = '';
    childProcess.stdout?.addListener('data', (data) => (output += data));
    childProcess.stderr?.addListener('data', (data) => (errorMessage += data));

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
