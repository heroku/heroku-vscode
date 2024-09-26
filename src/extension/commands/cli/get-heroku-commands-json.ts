import type { Command } from '@oclif/core/lib/command';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';

export declare namespace GetHerokuCommandsJson {
  export type ManifestMeta = Map<Command.Cached['id'], Command.Cached>;
}

@herokuCommand()
/**
 * The GetHerokuCommandsJson retrieves command meta data
 * from the heroku cli and returns it as a Map of
 * command id to command meta data.
 *
 * This data is used for the hover, intellisense, autocomplete and
 * error checking when authoring a shell script that uses the
 * heroku cli.
 */
export class GetHerokuCommandsJson extends HerokuCommand<GetHerokuCommandsJson.ManifestMeta> {
  public static COMMAND_ID = 'heroku:cli:get-commands' as const;
  private static manifestPromise: Promise<GetHerokuCommandsJson.ManifestMeta>;

  /**
   * Gets the heroku commands json based on
   * the current heroku cli installed on the
   * user's machine.
   *
   * @returns Command.Cached
   */
  public async run(): Promise<GetHerokuCommandsJson.ManifestMeta> {
    if (GetHerokuCommandsJson.manifestPromise !== undefined) {
      return GetHerokuCommandsJson.manifestPromise;
    }
    GetHerokuCommandsJson.manifestPromise = this.getManifest();
    return GetHerokuCommandsJson.manifestPromise;
  }

  /**
   * Gets the manifest of the heroku cli commands.
   *
   * @returns Promise<GetHerokuCommandsJson.ManifestMeta>
   */
  private async getManifest(): Promise<GetHerokuCommandsJson.ManifestMeta> {
    using commandsJsonProcess = HerokuCommand.exec('heroku commands --json', {
      signal: this.signal,
      timeout: 120 * 1000
    });
    const result = await HerokuCommand.waitForCompletion(commandsJsonProcess);
    const json = JSON.parse(result.output) as Command.Cached[];
    const manifest = new Map<Command.Cached['id'], Command.Cached>();
    for (const element of json) {
      manifest.set(element.id, element);
    }

    return manifest;
  }
}
