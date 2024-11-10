import type { Dyno, Formation } from '@heroku-cli/schema';
import vscode from 'vscode';
import { Command } from '@oclif/config';
import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { ScaleFormationCommand } from '../dyno/scale-formation';
import { herokuDynoSizes } from '../../utils/dyno-icons-by-size';
import { HerokuContextMenuCommandRunner } from './heroku-context-menu-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * The HerokuPsRunner is used to run commands
 * related to Dynos either from the command pallette
 * or the context menu of the Dynos view.
 */
export class HerokuPsRunner extends HerokuContextMenuCommandRunner {
  public static COMMAND_ID = 'heroku:ps:runner' as const;

  /**
   * @inheritDoc
   */
  protected executeCommand(fullyHydratedCommand: string, useTerminal?: boolean): Promise<void> {
    if (this.commandName === 'ps:scale') {
      return vscode.commands.executeCommand(ScaleFormationCommand.COMMAND_ID, this.targetDataModel) as Promise<void>;
    }
    return super.executeCommand(fullyHydratedCommand, useTerminal);
  }

  /**
   * @inheritdoc
   */
  protected async hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    dynoOrFormation?: Dyno | Formation
  ): Promise<void> {
    await super.hydrateArgs(userInputByArg, args, dynoOrFormation);

    if (args.dyno?.required && dynoOrFormation) {
      userInputByArg.set('dyno', this.isNamedObject(dynoOrFormation) ? dynoOrFormation.name : '');
    }

    if (this.commandName === 'ps:type' && dynoOrFormation) {
      Reflect.set(args, 'newSize', {});
      Reflect.set(args.newSize, 'description', 'Change the size of the Formation. This affects all Dynos.');
      this.injectDynoSizesOptions(args.newSize, dynoOrFormation as Formation);
    }
  }

  /**
   * @inheritdoc
   */
  protected async hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    dyno?: Dyno
  ): Promise<void> {
    await super.hydrateFlags(userInputByFlag, flags, dyno);
    if (flags.dyno && dyno) {
      userInputByFlag.set('dyno', dyno.name);
    }
  }

  /**
   * Builds the options for the dyno sizes.
   *
   * @param newSizeArgs The args object to inject the options into
   * @param formation The formation to build the options for
   */
  protected injectDynoSizesOptions(newSizeArgs: Command.Arg, formation: Formation): void {
    const options: Array<vscode.QuickPickItem & { value?: string }> = [];
    let lastPrefix: string | undefined;
    for (const dynoSize of Object.keys(herokuDynoSizes)) {
      const { description, icon: iconPath } = herokuDynoSizes[dynoSize];
      const prefix = dynoSize.split('-')[0];
      if (prefix !== lastPrefix) {
        options.push({ kind: vscode.QuickPickItemKind.Separator, label: prefix });
      }
      lastPrefix = prefix;
      options.push({
        description,
        label: dynoSize,
        picked: dynoSize === formation.size.toLowerCase(),
        iconPath,
        value: `${formation.type}=${dynoSize.toLowerCase()}`
      });
    }
    Reflect.set(newSizeArgs, 'options', options);
    Reflect.set(newSizeArgs, 'required', true);
  }
}
