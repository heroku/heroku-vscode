import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { CommandMeta } from '../../manifest';
import { HerokuCommandRunner } from './heroku-command-runner';

type MaybeNamedObjectWithApp = { name?: string; id?: string; app?: MaybeNamedObjectWithApp };

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 *
 */
export class HerokuContextMenuCommandRunner extends HerokuCommandRunner<MaybeNamedObjectWithApp> {
  public static COMMAND_ID = 'heroku:context:menu:command:runner';

  /**
   *
   * @inheritdoc
   */
  protected hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    context?: MaybeNamedObjectWithApp
  ): PromiseLike<void> | void {
    if (args.app?.required && context) {
      const appName = this.getAppNameFromContext(context);
      userInputByArg.set('app', appName);
    }
  }

  /**
   *
   * @inheritdoc
   */
  protected hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    context?: MaybeNamedObjectWithApp
  ): PromiseLike<void> | void {
    const appName = this.getAppNameFromContext(context);
    if (flags.app?.required && appName) {
      userInputByFlag.set('app', appName);
    }
    // Special case for destructive actions
    // e.g. ones with a `confirm` prompt
    // This structure will present the user with a warning
    // dialog and buttons to continue or cancel.
    if (flags.confirm) {
      Reflect.set(flags.confirm, 'required', true);
      Reflect.set(flags.confirm, 'type', 'boolean');
      Reflect.set(flags.confirm, 'default', true);
      Reflect.set(flags.confirm, 'hidden', false);
      Reflect.set(flags.confirm, 'default', appName);
      if (!flags.confirm.description) {
        Reflect.set(flags.confirm, 'description', 'This is a destructive action which cannot be undone');
      }
    }
  }

  /**
   * Utility function that hydrates the matching keys and
   * values from the context. In some cases, the name of
   * the flag or arg matches the property name of the context
   * object. In these cases, we just match up the keys and
   * values from the context.
   *
   * This function is to be called manually by
   * the implementing class as it is not called
   * automatically by the base class.
   *
   * Caution is recommended sice arg or flag names
   * meant for user input can sometimes match property
   * names on the context object leading to unexpected
   * results.
   *
   * @param userInputs Map of the user inputs
   * @param manifest The manifest to match flag or arg keys on the context
   * @param context The object to derive the values from
   * @param ignoreOptional Boolean indicating if optional values should be ignored
   */
  protected hydrateMatchingObjectKeys(
    userInputs: Map<string, string | undefined>,
    manifest: CommandMeta['flags'] | CommandMeta['args'],
    context: MaybeNamedObjectWithApp = {},
    ignoreOptional?: boolean
  ): void {
    const keys = Object.keys(manifest);
    for (const key of keys) {
      if (ignoreOptional && !manifest[key].required) {
        continue;
      }
      if (Reflect.has(context, key)) {
        const contextvalue = Reflect.get(context, key) as unknown;
        const inputValue = this.isNamedObject(contextvalue) ? contextvalue.name : contextvalue;
        userInputs.set(
          key,
          'type' in manifest[key] && manifest[key].type === 'boolean' ? undefined : (inputValue as string)
        );
      }
    }
  }

  /**
   * Gets the name of the app from the context
   *
   * @param context The context of the user's selection
   * @returns The name of the app from the context
   */
  protected getAppNameFromContext(context?: MaybeNamedObjectWithApp): string | undefined {
    if (context?.app) {
      return context.app.name;
    }
    return context?.name;
  }

  /**
   * Determines if the object is a named object with an app property
   *
   * @param obj The object to determine it's type
   * @returns boolean indicating if the object is a named object with an app property
   */
  protected isNamedObject(obj: unknown): obj is { name: string } {
    return typeof obj === 'object' && obj !== null && 'name' in obj;
  }
}
