import type { ChildProcess } from 'node:child_process';
import { exec } from 'node:child_process';

import vscode from 'vscode';
import { RunnableCommand } from '../meta/command';

export type HerokuCommandCompletionInfo = { exitCode: number | string; errorMessage: string; output: string };

export abstract class HerokuCommand<T> extends AbortController implements Disposable, RunnableCommand<T> {
  public static exec: typeof exec = exec;
  protected readonly outputChannel: vscode.OutputChannel | undefined;

  public constructor(outputChannel?: vscode.OutputChannel) {
    super();
    this.outputChannel = outputChannel;
  }

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

  public [Symbol.dispose](): void {
    this.abort();
  }

  public abstract run(...args: unknown[]): T | PromiseLike<T>;
}
