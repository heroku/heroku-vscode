import type { ChildProcess } from 'node:child_process';
import os from 'node:os';
import vscode from 'vscode';

import { herokuCommand } from '../../meta/command';
import { HerokuCommand, HerokuCommandCompletionInfo } from '../heroku-command';
import { logExtensionEvent } from '../../utils/logger';

export type AuthCompletionInfo = HerokuCommandCompletionInfo & {
  authType: 'browser' | 'terminal';
};

@herokuCommand()
/**
 * The login command delegates authentication to
 * the HerokuCLI using the browser auth flows.
 */
export class LoginCommand extends HerokuCommand<AuthCompletionInfo> {
  public static COMMAND_ID = 'heroku:auth:login' as const;

  /**
   * Event handler for the Heroku CLI stdout.
   * This handler looks for the prompt: "Press any key to open a browser.."
   * and writes a keystroke to stdin to automate the opening
   * of the browser without the need for user input.
   *
   * @param chunk The string output from the child process.
   * @param cliAuthProcess The HerokuCli child process.
   */
  private static onData(chunk: string, cliAuthProcess: ChildProcess): void {
    // The Heroku CLI sends the message:
    // "Press any key to open up the browser to login or q to exit:"
    if (chunk.includes('Press any key')) {
      cliAuthProcess.stdin?.write('o');
    }
  }

  /**
   * Runs the `heroku auth:login` command using
   * the browser auth flow and returns the uninterpreted
   * result from the child process.
   *
   * Note that the Heroku CLI does not terminate
   * properly on a successful auth attempt for an
   * unknown reason. This run function must kill
   * the child process manually as a result.
   *
   * @returns The result of the Heroku CLI command
   */
  public async run(): Promise<AuthCompletionInfo> {
    // If we're running in container, do not use the
    // browser since we're probably going to get an
    // "IP Mismatch" error.
    if (this.isRunningInContainer()) {
      return this.runInTerminal();
    }

    using cliAuthProcess = HerokuCommand.exec('heroku auth:login', { signal: this.signal, timeout: 120 * 1000 });
    cliAuthProcess.stderr?.addListener('data', (data: string) => LoginCommand.onData(data, cliAuthProcess));

    let success = false;
    cliAuthProcess.stdout?.addListener('data', (chunk: string) => {
      if (chunk.includes('Logged in as')) {
        success = true;
        cliAuthProcess.kill();
      }
    });

    const result = await HerokuCommand.waitForCompletion(cliAuthProcess);
    if (success) {
      result.exitCode = 0;
    }
    return { ...result, authType: 'browser' };
  }

  /**
   *
   *
   * @returns the result from running auth in a terminal
   */
  private async runInTerminal(): Promise<AuthCompletionInfo> {
    const stdoutFileLoc = vscode.Uri.file(`${os.tmpdir()}/${Date.now()}-auth-result.log`);
    const successWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(stdoutFileLoc, '*'));
    await vscode.workspace.fs.writeFile(stdoutFileLoc, new Uint8Array());
    // stdout, stderr
    let watcherDisposable: vscode.Disposable | undefined;
    const resultPromise = new Promise<AuthCompletionInfo>((resolve) => {
      watcherDisposable = successWatcher.onDidChange(async (file: vscode.Uri) => {
        const buffer = await vscode.workspace.fs.readFile(file);
        const result = buffer.toString();

        const resultLc = result.toLocaleLowerCase();
        const response: AuthCompletionInfo = {
          authType: 'terminal',
          errorMessage: '',
          exitCode: 0,
          output: result
        };
        // Auth success
        if (resultLc.includes('logged in as')) {
          resolve(response);
        }
        // Auth failed
        if (resultLc.includes('error:') || resultLc.includes('command not found')) {
          resolve({ ...response, exitCode: 1 });
        }
      });
    });

    const timeoutPromise = new Promise<AuthCompletionInfo>((resolve) => {
      // Timed out
      setTimeout(
        () =>
          resolve({
            authType: 'terminal',
            errorMessage: 'Authentication timed out after 60 seconds',
            exitCode: 1,
            output: ''
          }),
        60_000
      );
    });

    // user closed the terminal before auth could complete
    let terminalClosedDisposable: vscode.Disposable | undefined;
    const terminalClosePromise = new Promise<AuthCompletionInfo>((resolve) => {
      terminalClosedDisposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal === terminal) {
          resolve({
            authType: 'terminal',
            errorMessage: 'Terminal closed before auth could complete',
            exitCode: 1,
            output: ''
          });
        }
      });
    });

    const terminal = vscode.window.createTerminal({
      shellPath: vscode.env.shell,
      message: 'Heroku Interactive Authentication',
      isTransient: true,
      iconPath: new vscode.ThemeIcon('hk-icon-logo-outline-16'),
      name: 'Heroku Auth'
    } as vscode.TerminalOptions);
    terminal.show();
    terminal.sendText(`heroku auth:login --interactive 2>&1 | tee ${stdoutFileLoc.fsPath}`, true);

    logExtensionEvent(`using ${stdoutFileLoc.fsPath} to log auth responses from sever`);

    const result = await Promise.race([resultPromise, terminalClosePromise, timeoutPromise]);

    // Cleanup
    successWatcher.dispose();
    terminal.dispose();
    terminalClosedDisposable?.dispose();
    watcherDisposable?.dispose();
    await vscode.workspace.fs.delete(stdoutFileLoc, { useTrash: false });

    return result;
  }

  /**
   * Determines if the extension is running in a container
   * such as a GitHub Codespace, Code Builder or Docker
   *
   * @returns true if the extenion is running in a container.
   */
  private isRunningInContainer(): boolean {
    return (
      process.env['REMOTE_CONTAINERS'] === 'true' ||
      process.env['DOCKER_BUILDKIT'] === '1' ||
      process.env['SF_CONTAINER_MODE'] === 'true'
    );
  }
}
