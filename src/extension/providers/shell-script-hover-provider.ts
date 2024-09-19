import * as vscode from 'vscode';

import { Hover, Position, ProviderResult, TextDocument } from 'vscode';
import type { Command, Manifest } from '@oclif/config';
import sh from 'mvdan-sh';
import { ShellScriptLexer } from '../lexers/shell-script-lexer.js';
import { isHerokuCallExpression, isInsideRangeBoundary } from '../lexers/lexer-utils.js';
import * as manifest from '../meta/oclif.manifest.json';

/**
 * The ManifestMeta interface describes the
 * oclif manifest properties with the added
 * 'description' field and is used to satisfy
 * strong typing for the json used for
 * hover data.
 */
type ManifestMeta = {
  description: string;
  commands: {
    [id: string]: CorrectedCommand;
  };
} & Manifest;

type CorrectedCommand = Command & {
  args: Record<string, Command.Arg>;
};

/**
 * The ShellScriptHoverProvider is responsible for
 * building the markdown to be displayed by
 * VSCode when a targeted node is hovered.
 */
export class ShellScriptHoverProvider implements vscode.HoverProvider {
  private lexer = new ShellScriptLexer();

  /**
   * Template tag used to build the hover markdown
   * for Heroku commands.
   *
   * Usage:
   * ```ts
   * const commandInfo = ShellScriptHoverProvider.commandHoverTag`heroku${commandName}${description}### Options:\n${flags}### Examples:${examples}`;
   * ```
   *
   * @param parts The array of strings representing the template literal spans.
   * @param commandName The name of the command provided in the first template expression.
   * @param description The description of the command provided in the second template expression.
   * @param flags An object whose keys are command flag names and value is the Command.Flag object.
   * @param examples An array of strings that represent various command examples.
   * @returns string The tagged string
   */
  private static commandHoverTag(
    parts: TemplateStringsArray,
    commandName: string,
    description: string | undefined,
    flags: Record<string, Command.Flag>,
    examples: string[] | undefined
  ): string {
    const [herokuStr, , optionsStr, examplesStr] = parts;
    let output = `## ${herokuStr} ${commandName}\n${description}\n`;

    // Build out each line of the Options section
    const flagKeys: Array<keyof typeof flags> = Object.keys(flags).filter((key) => !flags[key].hidden);
    if (flagKeys.length) {
      output += optionsStr;

      // format is:
      // -char, --name=name
      output += '\n```';
      for (const flagName of flagKeys) {
        output += `\n${this.buildHoverMarkdownFromFlagMeta(flags[flagName]).value}\n`;
      }
      output += '\n```\n';
    }

    if (examples?.length) {
      output += `\n${examplesStr}\n \`\`\`bash \n${examples.join('\n')}\n\`\`\``;
    }

    return output;
  }

  /**
   * Builds the markdown for a command to display on hover.
   *
   * @param meta The json metadata describing the command details.
   * @returns vscode.MarkdownString
   */
  private static buildHoverMarkdownFromCommandMeta(meta: Command | undefined | null): vscode.MarkdownString {
    if (!meta) {
      return new vscode.MarkdownString();
    }
    const { description, flags, examples, id } = meta;
    const md = new vscode.MarkdownString(
      this.commandHoverTag`heroku${id}${description}### Options:\n${flags}### Examples:${examples}`
    );
    md.supportHtml = true;
    return md;
  }

  /**
   * Builds the hover markdown for a command flag
   *
   * @param meta The json meta data describing the command flag details
   * @param asCodeBlock boolean indidating whether this should be formatted as a code block
   * @returns vscode.MarkdownString
   */
  private static buildHoverMarkdownFromFlagMeta(
    meta: Command.Flag | undefined | null,
    asCodeBlock = false
  ): vscode.MarkdownString {
    if (!meta) {
      return new vscode.MarkdownString();
    }
    let output = asCodeBlock ? '```\n' : '';
    const { description: flagDescription, type, name, char } = meta;

    // format is:
    // # <description
    // -<char>, --<name>=the name
    output += `# ${flagDescription ?? ''}\n`;
    // char is optional but not expected to be falsy
    let line = char ? `-${char}, ` : '';

    line += `--${name}${type === 'option' ? `=the-${name}` : ''}`;
    output += `${line}`;

    output += asCodeBlock ? '\n```' : '';

    return new vscode.MarkdownString(output);
  }

  /**
   * Builds the hover data for a command argument.
   *
   * @param meta The json meta data describing the command argument
   * @param asCodeBlock boolean indicating whether this should be formatted as a code block
   * @returns vscode.MarkdownString
   */
  private static buildHoverMarkdowFromArgMeta(
    meta: Command.Arg | undefined | null,
    asCodeBlock = false
  ): vscode.MarkdownString {
    if (!meta) {
      return new vscode.MarkdownString();
    }
    let output = asCodeBlock ? '```\n' : '';
    const { name, description } = meta;
    output += `# ${name}\n${description ?? ''}`;
    output += asCodeBlock ? '\n```' : '';
    return new vscode.MarkdownString(output);
  }

  /**
   * Gets the command metadata by the specified command node.
   *
   * @param commandNode The sh.Word node representing the command to retrieve the metata for.
   * @returns Command or null if none found.
   */
  private static getCommandMetaByCommandNode(commandNode?: sh.Word | undefined | null): CorrectedCommand | null {
    const { commands } = manifest as unknown as ManifestMeta;
    const commandName = commandNode?.Lit();
    return commandName ? commands[commandName] : null;
  }

  /**
   * Entry point for the provider. Tbis function is called
   * automatically by VSCode.
   *
   * @param document The currently focused TextDocument in the editor
   * @param position The line and character which the user is currently hovering.
   * @returns ProviderResult<Hover>
   */
  public provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
    this.lexer.documentDidChange(document);
    const nodes = this.lexer.findNodesAtPosition(position);
    const node = nodes.find(isHerokuCallExpression);
    if (!node) {
      return;
    }
    const { Args: args } = node;
    const [heroku, command, ...flagsOrArgs] = args;
    // -----------------------------------
    // We're over a heroku call expression
    // -----------------------------------
    if (isInsideRangeBoundary(heroku, position)) {
      const { description } = manifest as unknown as ManifestMeta;
      return new vscode.Hover(description);
    }
    // ---------------------------
    // We're over a heroku command
    // ---------------------------
    if (isInsideRangeBoundary(command, position)) {
      const commandMeta = ShellScriptHoverProvider.getCommandMetaByCommandNode(command);
      return new vscode.Hover(ShellScriptHoverProvider.buildHoverMarkdownFromCommandMeta(commandMeta));
    }
    // -------------------------------
    // we're over a heroku flag or arg
    // -------------------------------
    const [targetFlagOrArg] = flagsOrArgs.filter((flagOrArg) => isInsideRangeBoundary(flagOrArg, position));
    if (!targetFlagOrArg) {
      return null;
    }
    const commandMeta = ShellScriptHoverProvider.getCommandMetaByCommandNode(command);
    if (commandMeta) {
      const id = targetFlagOrArg.Lit();
      let flagKey: string = '';
      // This is either a command argument or a flag value.
      if (!id.startsWith('-')) {
        const idx = flagsOrArgs.indexOf(targetFlagOrArg);
        // back up in the list of flags or args
        // until we find the associated flag or
        // we determine this is a command arg.
        let i = idx;
        while (i-- > -1) {
          const maybeFlag = flagsOrArgs[i];
          const maybeFladId = maybeFlag?.Lit() ?? '';
          if (maybeFladId.startsWith('-')) {
            flagKey = maybeFladId.replace(/^[-]+/, '');
            break;
          }
        }
        // We didn't find a flag so this
        // must be a command argument
        if (!flagKey) {
          // args occur in the order in which the
          // properties are defined. Indexed
          // keys will be accurately mapped.
          const { args: commandArgs } = commandMeta;
          const commndArgKey = Object.keys(commandArgs)[idx];
          const commandArg = commandArgs[commndArgKey];
          return new vscode.Hover(ShellScriptHoverProvider.buildHoverMarkdowFromArgMeta(commandArg, true));
        }
      } else if (id.startsWith('-')) {
        // might be in the format --flag=flag-value
        const [flagId] = id.split('=');
        flagKey = flagId.replace(/^[-]+/, '');
      }
      const { flags: flagsMeta } = commandMeta;
      const targetFlag = flagsMeta[flagKey];
      return new vscode.Hover(ShellScriptHoverProvider.buildHoverMarkdownFromFlagMeta(targetFlag, true));
    }

    return null;
  }
}
