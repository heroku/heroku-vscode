import { AddOn } from '@heroku-cli/schema';
import { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { HerokuCommandRunner } from './heroku-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * Any other commands. This acts as a catch-all for commands
 * that do to have a dedicated command runner.
 */
export class HerokuAddOnCommandRunner extends HerokuCommandRunner<unknown> {
  public static COMMAND_ID = 'heroku:addOn:runner';

  /**
   *
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    addOn: AddOn
  ): PromiseLike<void> | void {
    if (args.app?.required && addOn) {
      userInputByArg.set('app', addOn.app.name);
    }
    if (args.addon?.required && addOn) {
      userInputByArg.set('addon', addOn.name);
    }
    if (args.addonName?.required && addOn) {
      userInputByArg.set('addonName', addOn.name);
    }
  }

  /**
   *
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    addOn: AddOn
  ): PromiseLike<void> | void {
    if (flags.app && addOn) {
      userInputByFlag.set('app', addOn.app.name);
    }
    if (flags.addon?.required && addOn) {
      userInputByFlag.set('addon', addOn.name);
    }
    if (flags.addonName?.required && addOn) {
      userInputByFlag.set('addonName', addOn.name);
    }
    // Special case for destructive actions e.g. ones with a `confirm` prompt
    if (flags.confirm) {
      Reflect.set(flags.confirm, 'required', true);
      Reflect.set(flags.confirm, 'type', 'boolean');
      Reflect.set(flags.confirm, 'default', true);
      Reflect.set(flags.confirm, 'hidden', false);
      Reflect.set(flags.confirm, 'default', addOn?.app?.name);
      if (!flags.confirm.description) {
        Reflect.set(flags.confirm, 'description', 'this is a destructive action which cannot be undone');
      }
    }
  }
}
