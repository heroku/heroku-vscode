import type { Command, Manifest } from '@oclif/config';

/**
 * The ManifestMeta interface describes the
 * oclif manifest properties with the added
 * 'description' field and is used to satisfy
 * strong typing for the json used for
 * hover data.
 */
export type ManifestMeta = {
  description: string;
  commands: {
    [id: string]: CommandMeta;
  };
} & Manifest;

export type CommandMeta = Omit<Command, 'args'> & {
  args: Record<string, Command.Arg>;
};
