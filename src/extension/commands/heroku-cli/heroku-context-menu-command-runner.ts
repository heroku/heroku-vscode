import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { CommandMeta } from '../../manifest';
import { FlagsOrArgs, HerokuCommandRunner } from './heroku-command-runner';

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
    if (flags.app && appName) {
      userInputByFlag.set('app', appName);
    }
  }

  /**
   * @inheritdoc
   */
  protected collectInputsFromManifest(flagsOrArgsManifest: FlagsOrArgs, omitOptional?: boolean): string[] {
    const collectedInputs = super.collectInputsFromManifest(flagsOrArgsManifest, omitOptional);
    // If we're asking for an app, let's not also
    // ask for a remote.
    if (collectedInputs.includes('app') && collectedInputs.includes('remote')) {
      collectedInputs.splice(collectedInputs.indexOf('remote'), 1);
    }
    return collectedInputs;
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
