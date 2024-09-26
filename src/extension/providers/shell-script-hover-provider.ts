import * as vscode from 'vscode';

import { Hover, Position, TextDocument } from 'vscode';
import sh from 'mvdan-sh';
import type { Command } from '@oclif/core/lib/command';
import { ShellScriptLexer } from '../lexers/shell-script-lexer.js';
import { GetHerokuCommandsJson } from '../commands/cli/get-heroku-commands-json.js';

/**
 * The ShellScriptHoverProvider is responsible for
 * building the markdown to be displayed by
 * VSCode when a targeted node is hovered.
 */
export class ShellScriptHoverProvider implements vscode.HoverProvider {
  private static manifest: GetHerokuCommandsJson.ManifestMeta;
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
    flags: Record<string, Command.Flag.Cached>,
    examples: Command.Example[] | undefined
  ): string {
    const [herokuStr, , optionsStr, examplesStr] = parts;
    let output = `## ${herokuStr} ${commandName}\n${description}\n`;
    const examplesArray = examples && !Array.isArray(examples) ? [examples] : examples;

    // Build out each line of the Options section
    const flagKeys: Array<keyof typeof flags> = Object.keys(flags).filter((key) => !flags[key].hidden);
    if (flagKeys.length) {
      output += optionsStr;

      // format is:
      // -char, --name=name
      output += '\n```';
      for (const flagName of flagKeys) {
        output += `\n${this.buildHoverMarkdownFromFlagMeta(flags[flagName], flagName).value}\n`;
      }
      output += '\n```\n';
    }

    if (examplesArray?.length) {
      output += `\n${examplesStr}\n \`\`\`bash \n${examplesArray.join('\n')}\n\`\`\``;
    }

    return output;
  }

  /**
   * Builds the markdown for a command to display on hover.
   *
   * @param meta The json metadata describing the command details.
   * @returns vscode.MarkdownString
   */
  private static buildHoverMarkdownFromCommandMeta(meta: Command.Cached | undefined | null): vscode.MarkdownString {
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
   * @param meta The json meta data describing the command flag details.
   * @param flagName The name of the flag.
   * @param asCodeBlock boolean indidating whether this should be formatted as a code block.
   * @returns vscode.MarkdownString
   */
  private static buildHoverMarkdownFromFlagMeta(
    meta: Command.Flag.Cached | undefined | null,
    flagName: string,
    asCodeBlock = false
  ): vscode.MarkdownString {
    if (!meta) {
      return new vscode.MarkdownString();
    }
    let output = asCodeBlock ? '```\n' : '';
    const { description: flagDescription, type, char } = meta;

    // format is:
    // # <description
    // -<char>, --<name>=the name
    output += `# ${flagDescription ?? ''}\n`;
    // char is optional but not expected to be falsy
    let line = char ? `-${char}, ` : '';

    line += `--${flagName}${type === 'option' ? `=the-${flagName}` : ''}`;
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
    meta: Command.Arg.Cached | undefined | null,
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
  private static getCommandMetaByCommandNode(commandNode?: sh.Word | undefined | null): Command.Cached | null {
    const commandName = commandNode?.Lit();
    return ShellScriptHoverProvider.manifest.get(commandName ?? '') ?? null;
  }

  /**
   * Entry point for the provider. Tbis function is called
   * automatically by VSCode.
   *
   * @param document The currently focused TextDocument in the editor
   * @param position The line and character which the user is currently hovering.
   * @returns ProviderResult<Hover>
   */
  public async provideHover(document: TextDocument, position: Position): Promise<Hover | undefined> {
    ShellScriptHoverProvider.manifest = await vscode.commands.executeCommand<GetHerokuCommandsJson.ManifestMeta>(
      GetHerokuCommandsJson.COMMAND_ID
    );

    this.lexer.documentDidChange(document);

    const entity = this.lexer.findEntityAtPosition(position);
    switch (entity?.type) {
      case 'heroku':
        return this.provideHerokuHover();

      case 'command':
        return this.provideHerokuCommandHover(entity.node as sh.Word);

      case 'flag':
        return this.provideHerokuFlagHover(entity.node as sh.Word, entity.flagKey, entity.command);

      case 'arg':
        return this.provideHerokuArgHover(entity.node as sh.Word, entity.command, entity.argIndex);

      default:
        return;
    }
  }

  /**
   * Provides the hover data for the heroku command.
   *
   * @returns vscode.Hover
   */
  private provideHerokuHover(): vscode.Hover {
    const description =
      'The Heroku CLI is used to manage Heroku apps from the command line. It is built using [oclif](https://oclif.io).\nFor more about Heroku see <https://www.heroku.com/home>\nTo get started see <https://devcenter.heroku.com/start>';
    return new vscode.Hover(description);
  }

  /**
   * Provides the hover for the heroku command name.
   *
   * @param node sh.Word The node representing the heroku command name
   * @returns vscode.Hover
   */
  private provideHerokuCommandHover(node: sh.Word): vscode.Hover {
    const commandMeta = ShellScriptHoverProvider.getCommandMetaByCommandNode(node);
    return new vscode.Hover(ShellScriptHoverProvider.buildHoverMarkdownFromCommandMeta(commandMeta));
  }

  /**
   * Provides the hover for the heroku command flag
   *
   * @param node The node representing the flag
   * @param flagName The name of the flag (without dashes)
   * @param commandNode The node representing the command name.
   * @returns vscode.Hover
   */
  private provideHerokuFlagHover(node: sh.Word, flagName: string, commandNode: sh.Word): vscode.Hover | undefined {
    const commandMeta = ShellScriptHoverProvider.getCommandMetaByCommandNode(commandNode);
    if (!commandMeta) {
      return;
    }
    const { flags: flagsMeta } = commandMeta;
    const targetFlag = flagsMeta[flagName];
    return new vscode.Hover(ShellScriptHoverProvider.buildHoverMarkdownFromFlagMeta(targetFlag, flagName, true));
  }

  /**
   * Provides the hover for the heroku command argument.
   *
   * @param node The node representing the heroku command Arg.
   * @param commandNode The node representing the command name.
   * @param argIndex The index of the argument in the command's args array.
   * @returns vscode.Hover | undefined
   */
  private provideHerokuArgHover(node: sh.Word, commandNode: sh.Word, argIndex: number): vscode.Hover | undefined {
    const commandMeta = ShellScriptHoverProvider.getCommandMetaByCommandNode(commandNode);
    if (!commandMeta) {
      return;
    }
    // args occur in the order in which the
    // properties are defined. Indexed
    // keys will be accurately mapped.
    const { args: commandArgs } = commandMeta;
    const commndArgKey = Object.keys(commandArgs)[argIndex];
    const commandArg = commandArgs[commndArgKey];
    return new vscode.Hover(ShellScriptHoverProvider.buildHoverMarkdowFromArgMeta(commandArg, true));
  }
}
