import type { ChildProcess } from 'node:child_process';
import { exec } from 'node:child_process';

import fs from 'node:fs';
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

  protected readonly context: vscode.ExtensionContext | undefined;
  protected readonly outputChannel: vscode.OutputChannel | undefined;

  /**
   * Constructs a new HerokuCommand
   *
   * @param outputChannel The optional output channel. This can be used to pipe the Heroku CLI stdout or sdterr messages.
   * @param context The extension context.
   */
  public constructor(outputChannel?: vscode.OutputChannel, context?: vscode.ExtensionContext) {
    super();
    this.outputChannel = outputChannel;
    this.context = context;
  }

  /**
   * Waits for the specified child process to complete.
   * Completion is defied as exiting with or without a code
   * or the child process closing, whichever is first.
   *
   * If an OutputChannel is provided, the output
   * of the child process will be written to the OutputChannel. If a
   * Terminal is provided, the output of the child process will be
   * written to the Terminal.
   *
   * @param childProcess The child process to wait on.
   * @param outputWriter The output channel or terminal to write to. This can be used to pipe the Heroku CLI stdout or sdterr messages.
   * @returns HerokuCommandCompletionInfo
   */
  public static async waitForCompletion(
    childProcess: ChildProcess,
    outputWriter?: vscode.OutputChannel | { sendText?: (text: string) => void }
  ): Promise<HerokuCommandCompletionInfo> {
    let output = '';
    let errorMessage = '';

    const writeText = (data: string): void => {
      if (this.isOutputChannel(outputWriter)) {
        outputWriter?.appendLine?.(data);
      } else {
        outputWriter?.sendText?.(data);
      }
    };

    childProcess.stdout?.addListener('data', (data: string) => {
      writeText(data);
      output += data;
    });

    childProcess.stderr?.addListener('data', (data: string) => {
      writeText(data);
      errorMessage += data;
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
   * Tests whether the specified object is an OutputChannel
   *
   * @param obj The object to test
   * @returns boolean indicating whether the object is an OutputChannel
   */
  protected static isOutputChannel(obj: unknown): obj is vscode.OutputChannel {
    return !!obj && typeof obj === 'object' && 'appendLine' in obj;
  }

  /**
   * Disposes of any pending API requests or
   * child processes.
   */
  public [Symbol.dispose](): void {
    this.abort();
  }

  /**
   * Gets the working directory of the current workspace.
   * If no workspace is open, the current directory is returned.
   *
   * @returns string the path of the working director
   */
  protected getWorkingDirectory = (): string => {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return process.cwd(); // Fallback to current directory
    }

    // Use fsPath instead of path for better cross-platform compatibility
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
      // Verify the directory exists and is accessible
      fs.accessSync(workspacePath, fs.constants.R_OK | fs.constants.X_OK);
      return workspacePath;
    } catch (error) {
      return process.cwd(); // Fallback if workspace path is inaccessible
    }
  };

  public abstract run(...args: unknown[]): T | PromiseLike<T>;
}
