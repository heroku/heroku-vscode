import { Duplex } from 'node:stream';
import vscode from 'vscode';
import type { Command } from '@oclif/config';
import { HerokuCommand } from '../heroku-command';
import manifest from '../../meta/oclif.manifest.json';
import { CommandMeta } from '../../manifest';

export type FlagsOrArgs = CommandMeta['flags'] | CommandMeta['args'];
export type CommandFlagAndArgUnion = Command.Arg &
  Command.Flag &
  ({ options: vscode.QuickPickItem[] } & { value: string });
/**
 * The HerokuAppsRunner is used to execute the
 * Heroku CLI for the apps topic.
 */
export abstract class HerokuCommandRunner<T> extends HerokuCommand<void> {
  protected commandName: keyof typeof manifest.commands | undefined;
  protected targetDataModel: T | undefined;
  protected userArgDefaults: Map<string, string | undefined> | undefined;
  protected userFlagDefaults: Map<string, string | undefined> | undefined;
  /**
   * @inheritdoc
   */
  public async run(
    commandName: keyof typeof manifest.commands,
    targetDataModel: T,
    userArgDefaults?: Map<string, string | undefined>,
    userFlagDefaults?: Map<string, string | undefined>
  ): Promise<void> {
    this.commandName = commandName;
    this.targetDataModel = targetDataModel;
    this.userArgDefaults = userArgDefaults;
    this.userFlagDefaults = userFlagDefaults;

    const command = await this.buildCommandShellScript(commandName, targetDataModel);
    if (!command) {
      return;
    }
    await this.executeCommand(command);
  }

  /**
   * Builds the command string to run after
   * receiving the necessary inputs from the
   * user. By default the manifest definition
   * is used.
   *
   * Implementors can override this function to
   * build any shell script whatsoever when needed
   * bearing in mind that any string returned by this
   * function is executed in a terminal or child
   * process and must be from a trusted source.
   *
   * Return `undefined` to indicate the user has
   * cancelled or that the command should not be run.
   *
   * @param commandName The name of the command to run
   * @param targetDataModel The data model to run the command against
   * @returns The command to run or undefined if the user has cancelled
   */
  protected async buildCommandShellScript(
    commandName: keyof typeof manifest.commands,
    targetDataModel: T
  ): Promise<string | undefined> {
    const commandManifest = manifest.commands[commandName] as CommandMeta;
    const { args, flags } = commandManifest;

    let command = `heroku ${commandName}`;
    const userInputByArg = this.userArgDefaults ?? new Map<string, string | undefined>();
    await this.hydrateArgs(userInputByArg, args, targetDataModel);

    let cancelled = await this.getInput(args, userInputByArg, !!targetDataModel);
    if (cancelled) {
      return;
    }
    for (const [, value] of userInputByArg) {
      command += ` ${value}`;
    }

    const userInputByFlag = this.userFlagDefaults ?? new Map<string, string | undefined>();
    await this.hydrateFlags(userInputByFlag, flags, targetDataModel);

    cancelled = await this.getInput(flags, userInputByFlag, !!targetDataModel);
    if (cancelled) {
      return;
    }

    for (const [flag, value] of userInputByFlag) {
      command += ` --${flag}`;
      if (value) {
        command += ` ${value}`;
      }
    }

    return command;
  }

  /**
   * Executes the command. By default, the
   * command is sent to a separate shell process
   * and the results are piped to a vscode.Pseudoterminal.
   *
   * This can be overridden by the implementor to
   * specify another behavior.
   *
   * When <code>useTerminal</code> is false, the command
   * is executed in a separate shell process and the
   * results are piped to the vscode.Pseudoterminal.
   *
   * When <code>useTerminal</code> is true, the command
   * is executed in a terminal as fire-and-forget.
   *
   * @param fullyHydratedCommand The fully hydrated command with all flags and args to run
   * @param useTerminal Whether to use a terminal to run the command
   * @returns A promise that resolves when the command is complete or it has been successfully sent to the terminal
   */
  protected async executeCommand(fullyHydratedCommand: string, useTerminal?: boolean): Promise<void> {
    // fire-and-forget - no way to get output but it's a "real" terminal
    if (useTerminal) {
      const terminal = vscode.window.createTerminal(this.commandName, vscode.env.shell, []);
      terminal.show();
      terminal.sendText(fullyHydratedCommand, true);
      return;
    }
    // Spin up the Heroku CLI and force colors.
    // A vscode.Pseudoterminal is not TTY but does
    // support ANSI colors.
    const herokuProcess = HerokuCommand.exec(fullyHydratedCommand, {
      signal: this.signal,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '3' },
      cwd: vscode.workspace.workspaceFolders?.[0].uri.path
    });

    // We want to distinguish between user input
    // and the Heroku CLI output. The Duplex stream
    // allows us to pipe stdin and stderr data from
    // the CLI to the Pseudoterminal while the
    // `handleInput()` function in the pty
    // allows a hook for user keystrokes.
    const writeEmitter = new vscode.EventEmitter<string>();
    const writable = new Duplex({
      autoDestroy: true,
      // output from the Heroku CLI is available here
      write(chunk: string, _encoding: BufferEncoding, callback: (error: Error | null | undefined) => void): void {
        const data = chunk.toString().replaceAll('\n', '\r\n');
        writeEmitter.fire(data);
        callback(null);
      }
    });
    herokuProcess.stdout?.pipe(writable);
    herokuProcess.stderr?.pipe(writable);

    // Setup the PTY. This configuration
    // along with the above Duplex stream
    // means that all data from the `handleInput()`
    // function is user input.
    let stdinBuffer = '';
    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      open: () => writeEmitter.fire(`$ ${fullyHydratedCommand}\r\n`),
      close: () => {
        this.abort();
      },
      handleInput: (data: string) => {
        // Heroku CLI has exited - wait for 'q'
        if (herokuProcess.exitCode !== null) {
          return data === 'q' && pseudoterminal.dispose();
        }
        // Send navigation keys to stdin since there
        // may be some instances where the CLI asks
        // the user to choose from a list.
        const arrowKeys = ['\u001b[A', '\u001b[B', '\u001b[C', '\u001b[D'];
        if (arrowKeys.some((key) => data.startsWith(key))) {
          herokuProcess.stdin?.write(data);
        }
        // all other ANSI control chars - implement later if needed
        if (data.startsWith('\u001b[')) {
          return;
        }
        // CTRL+C
        if (data.startsWith('\x03')) {
          herokuProcess.kill('SIGINT');
          return;
        }
        // all other user inputs
        writeEmitter.fire(data.replaceAll('\r', '\r\n'));
        if (data === '\r') {
          herokuProcess.stdin?.write(`${stdinBuffer}\r\n`);
          stdinBuffer = '';
        } else if (data === '\u007F') {
          // backspace
          if (stdinBuffer.length > 0) {
            writeEmitter.fire('\b \b');
          }
          stdinBuffer = stdinBuffer.slice(0, -1);
        } else {
          stdinBuffer += data;
        }
      }
    };

    const pseudoterminal = vscode.window.createTerminal({
      name: this.commandName,
      pty,
      iconPath: new vscode.ThemeIcon('hk-icon-logo-outline-16')
    } as vscode.ExtensionTerminalOptions);
    pseudoterminal.show();

    // Once the Heroku CLI has exited,
    // wait for the user to close the
    // terminal or press q to quit.
    await new Promise((resolve) =>
      herokuProcess.once('exit', (code: number, signal: string) => resolve(code ?? signal))
    );

    const message = herokuProcess.exitCode ? 'Failed -' : 'Completed -';
    writeEmitter.fire(`\n${message} Press "q" to quit:`);
  }

  /**
   * Gets the user's input for the flags requested in the command manifest
   *
   * @param flagsOrArgsManifest The manifest of flags or args for the command
   * @param userInputMap The object to store the user's input for each key
   * @param omitOptional Whether to omit optional flags from the input
   * @returns boolean indicating whether the user cancelled the command
   */
  protected async getInput(
    flagsOrArgsManifest: FlagsOrArgs,
    userInputMap: Map<string, string | undefined>,
    omitOptional: boolean
  ): Promise<boolean> {
    const flagsOrArgs = this.collectInputsFromManifest(flagsOrArgsManifest, omitOptional);

    for (const flagOrArg of flagsOrArgs) {
      // Skip anything that already exists
      // values may come from calls to hydrateArgs()
      // or hydrateFlags()
      if (userInputMap.has(flagOrArg)) {
        continue;
      }

      const { description, type, hidden } = flagsOrArgsManifest[flagOrArg] as CommandFlagAndArgUnion;

      // hidden args and flags may be exposed later
      // based on the user type. For now, skip them.
      if (!description || hidden) {
        continue;
      }
      const cancelled = await (type === 'boolean' ? this.showBooleanDialog : this.showOtherDialog)(
        flagsOrArgsManifest[flagOrArg] as CommandFlagAndArgUnion,
        userInputMap
      );
      if (cancelled) {
        return true;
      }
    }
    return false;
  }

  /**
   * Shows a dialog for a boolean flag.
   * Boolean inputs are limited to flags only
   * and are never required since their omission
   * indicates a falsy value. The exception is
   * the `--confirm` flag which presents as a
   * boolean dialog but is always required for
   * the action to be performed.
   *
   * @param commandFlag The manifest of the flag
   * @param userInputMap The map of user input
   * @returns boolean indicating if the user cancelled
   */
  protected showBooleanDialog = async (
    commandFlag: Command.Flag & { default?: string },
    userInputMap: Map<string, string | undefined>
  ): Promise<boolean> => {
    const { description, default: defaultValue, name: flagOrArgName } = commandFlag;
    const choice = await vscode.window.showQuickPick(['Yes', 'No', 'Cancel'], { title: description });
    // user cancelled
    if (choice === undefined || choice === 'Cancel') {
      return true;
    }
    if (choice === 'Yes') {
      userInputMap.set(flagOrArgName, defaultValue);
    }
    return false;
  };

  /**
   * Shows a mix of dialogs depending on the type of
   * user input that's required.
   *
   * @param commandFlagOrArg The manifest of the flag/arg
   * @param userInputMap The map of user input
   * @returns boolean indicating if the user cancelled
   */
  protected showOtherDialog = async (
    commandFlagOrArg: CommandFlagAndArgUnion,
    userInputMap: Map<string, string | undefined>
  ): Promise<boolean> => {
    const { description, default: defaultValue, options, required, name: flagOrArgName } = commandFlagOrArg;

    let input: string | undefined;
    const isFileInput = description?.includes('absolute path');
    if (isFileInput) {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: description
      });
      input = uris?.[0].fsPath;
    } else if (options) {
      const choice = await vscode.window.showQuickPick(options, {
        canPickMany: false,
        title: description
      });
      input = this.isValueItem(choice) ? choice.value : choice;
    } else {
      input = await vscode.window.showInputBox({
        prompt: `${description} (${required ? 'required' : 'optional - press "Enter" to bypass'})`,
        value: defaultValue,
        validateInput: (value: string) => {
          if (required && !value) {
            return `${description} is required`;
          }
          return '';
        }
      });
    }
    // user cancelled
    if (input === undefined) {
      return true;
    }
    if (input !== '') {
      userInputMap.set(flagOrArgName, input);
    }
    return false;
  };

  /**
   * Collects the names of the flags and args requested in the command manifest
   *
   * @param flagsOrArgsManifest The manifest of flags or args for the command
   * @param omitOptional Whether to omit optional flags from the input
   *
   * @returns An array of strings representing the inputs to get from the user
   */
  protected collectInputsFromManifest(flagsOrArgsManifest: FlagsOrArgs, omitOptional?: boolean): string[] {
    const requiredInputs: string[] = [];
    const optionalInputs: string[] = [];

    // Prioritize options over booleans to
    // prevent the user from yo-yoing back and
    // forth between the different input dialogs
    const keysByType = Object.keys(flagsOrArgsManifest).sort((a, b) => {
      const { type: aType } = flagsOrArgsManifest[a] as { type: string };
      const { type: bType } = flagsOrArgsManifest[b] as { type: string };
      if (aType === bType) {
        return 0;
      }
      if (aType === 'option') {
        return -1;
      }
      if (bType === 'option') {
        return 1;
      }
      return 0;
    });

    keysByType.forEach((key) => {
      const isRequired = Reflect.get(flagsOrArgsManifest[key], 'required');
      (isRequired ? requiredInputs : optionalInputs).push(key);
    });
    // Prioritize required inputs
    // over optional inputs when
    // prompting the user.
    // required inputs are sorted
    // alphabetically. optional
    // inputs are sorted alphabetically
    // and then pushed to the end of
    // the list.
    requiredInputs.sort((a, b) => {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    });
    // Include optional only when not explicitly omitted
    return omitOptional ? requiredInputs : [...requiredInputs, ...optionalInputs];
  }

  /**
   * Checks if the object is a vscode.QuickPickItem
   *
   * @param obj The object to check if it is a vscode.QuickPickItem
   * @returns boolean indicting whether it is a vscode.QuickPickItem
   */
  protected isValueItem(obj?: unknown): obj is { value: string } {
    return !!obj && typeof obj === 'object' && 'value' in obj;
  }

  /**
   * Pre-fill the user's input for the flags requested in the command manifest
   *
   * @param userInputByFlag Map used to store user inputs
   * @param flags Manifest used to pull the details of the flags
   * @param targetDataModel The data model from which to pull default values for the flags
   */
  protected abstract hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    targetDataModel?: T
  ): PromiseLike<void> | void;

  /**
   * Pre-fill the user's input for the flags requested in the command manifest
   *
   * @param userInputByArg Map used to store user inputs
   * @param args Manifest used to pull the details of the args
   * @param targetDataModel The data model from which to pull default values for the flags
   */
  protected abstract hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    targetDataModel?: T
  ): PromiseLike<void> | void;
}
