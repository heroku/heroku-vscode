import vscode from 'vscode';
import type { Command } from '@oclif/config';
import { HerokuCommand } from '../heroku-command';
import manifest from '../../meta/oclif.manifest.json';
import { CommandMeta } from '../../manifest';

type FlagsOrArgs = CommandMeta['flags'] | CommandMeta['args'];

/**
 * The HerokuAppsRunner is used to execute the
 * Heroku CLI for the apps topic.
 */
export abstract class HerokuCommandRunner<T> extends HerokuCommand<void> {
  /**
   * @inheritdoc
   */
  public async run(commandTopic: keyof typeof manifest.commands, targetDataModel: T): Promise<void> {
    const commandManifest = manifest.commands[commandTopic] as CommandMeta;
    const { args, flags } = commandManifest;

    const userInputByFlag: Map<string, string | undefined> = new Map();
    await this.hydrateFlags(userInputByFlag, flags, targetDataModel);

    let cancelled = await this.getInput(flags, userInputByFlag, !!targetDataModel);
    if (cancelled) {
      return;
    }

    let command = `heroku ${commandTopic}`;
    for (const [flag, value] of userInputByFlag) {
      command += ` --${flag}`;
      if (value) {
        command += ` ${value}`;
      }
    }

    const userInputByArg: Map<string, string | undefined> = new Map();
    await this.hydrateArgs(userInputByArg, args, targetDataModel);

    cancelled = await this.getInput(args, userInputByArg, !!targetDataModel);
    if (cancelled) {
      return;
    }
    for (const [, value] of userInputByArg) {
      command += ` ${value}`;
    }

    this.outputChannel?.show();
    this.outputChannel?.appendLine(`$ ${command}`);
    const herokuProcess = HerokuCommand.exec(command, { signal: this.signal });
    await HerokuCommand.waitForCompletion(herokuProcess, this.outputChannel);
  }

  /**
   * Gets the user's input for the flags requested in the command manifest
   *
   * @param flagsOrArgsManifest The manifest of flags or args for the command
   * @param userInputMap The object to store the user's input for each key
   * @param omitOptinal Whether to omit optional flags from the input
   * @returns boolean indicating whether the user cancelled the command
   */
  protected async getInput(
    flagsOrArgsManifest: FlagsOrArgs,
    userInputMap: Map<string, string | undefined>,
    omitOptinal: boolean
  ): Promise<boolean> {
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

    keysByType.forEach((flag) => {
      const isRequired = Reflect.get(flagsOrArgsManifest[flag], 'required');
      (isRequired ? requiredInputs : optionalInputs).push(flag);
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
    const flagsOrArgs = omitOptinal ? requiredInputs : [...requiredInputs, ...optionalInputs];

    for (const flagOrArg of flagsOrArgs) {
      if (userInputMap.has(flagOrArg)) {
        continue;
      }
      // Some inputs do not have a description - I sure hope these aren't required
      const {
        description,
        type,
        hidden,
        required,
        default: defaultValue
      } = flagsOrArgsManifest[flagOrArg] as Command.Arg & Command.Flag;
      if (!description || hidden) {
        continue;
      }
      // Boolean inputs are limited to flags only
      // and are never required since their omission
      // indicates a falsy value.
      if (type === 'boolean') {
        // To prevent the user from being prompted
        // for a boolean flag using an input box
        // which requires typing a yes/no response,
        // we use an information message with "yes", "no"
        // or cancel button choices.
        const choice = await vscode.window.showInformationMessage(`Should we ${description}?`, 'Yes', 'No', 'Cancel');
        // user cancelled
        if (choice === undefined || choice === 'Cancel') {
          return true;
        }
        if (choice === 'Yes') {
          userInputMap.set(flagOrArg, undefined);
        }
      } else {
        const input = await vscode.window.showInputBox({
          prompt: `Enter the ${description} (${required ? 'required' : 'optional - press "Enter" to bypass'})`,
          value: defaultValue,
          validateInput: (value: string) => {
            if (required && !value) {
              return `${description} is required`;
            }
            return '';
          }
        });
        // user cancelled
        if (input === undefined) {
          return true;
        }
        if (input !== '') {
          userInputMap.set(flagOrArg, input);
        }
      }
    }
    return false;
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
