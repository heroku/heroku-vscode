import * as vscode from 'vscode';
import sh from 'mvdan-sh';
import type { Command } from '@oclif/core/lib/command';
import { ShellScriptLexer } from '../lexers/shell-script-lexer';
import { GetHerokuCommandsJson } from '../commands/cli/get-heroku-commands-json';

/**
 * Provides completion items for shell script files
 * that contain Heroku CLI commands.
 */
export class ShellScriptCompletionProvider implements vscode.CompletionItemProvider {
  private manifest: GetHerokuCommandsJson.ManifestMeta;
  private lexer = new ShellScriptLexer();
  /**
   * @inheritdoc
   */
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | undefined | null> {
    this.lexer.documentDidChange(document);
    // Include call expressions that start with at least "her"
    // so we don't have to wait until the user fully types
    // "heroku" before we suggest completion items.
    const entity = this.lexer.findEntityAtPosition(position, true);
    if (!entity) {
      return;
    }
    this.manifest = await vscode.commands.executeCommand<GetHerokuCommandsJson.ManifestMeta>(
      GetHerokuCommandsJson.COMMAND_ID
    );
    switch (entity.type) {
      case 'heroku':
        return this.provideHerokuCompletionItems();

      case 'command':
        return this.provideCommandCompletionItems(entity.node);

      case 'flag':
        return this.provideFlagCompletionItems(entity.command, entity.node, entity.flagKey);

      case 'arg':
        return this.provideArgCompletionItems(entity.command, entity.node, entity.argIndex);

      default:
        return;
    }
  }

  /**
   * Provides completion items for the Heroku CLI.
   *
   * @returns vscode.CompletionItem[]
   */
  private provideHerokuCompletionItems(): vscode.ProviderResult<vscode.CompletionItem[]> {
    const items: vscode.CompletionItem[] = [];
    for (const [commandName, commandMeta] of this.manifest) {
      const completionItem = new vscode.CompletionItem(commandName, vscode.CompletionItemKind.Struct);
      completionItem.insertText = this.buildSnippetFromCommandMeta(commandMeta);
    }

    return items;
  }

  /**
   * Provides completion items for Heroku CLI commands.
   *
   * @param command The command to provide completion items for.
   * @returns vscode.CompletionItem[]
   */
  private provideCommandCompletionItems(command: sh.Node): vscode.ProviderResult<vscode.CompletionItem[]> {
    return null;
  }

  /**
   * Provides completion items for Heroku CLI flags.
   *
   * @param command The command to provide flag completion items for.
   * @param node The node representing the flag.
   * @param flagKey The key of the flag.
   * @returns vscode.CompletionItem[]
   */
  private provideFlagCompletionItems(
    command: sh.Node,
    node: sh.Node,
    flagKey: string
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    return null;
  }

  /**
   * Provides completion items for Heroku CLI arguments.
   *
   * @param command The command to provide argument completion items for.
   * @param node The node representing the argument.
   * @param argIndex The index of the argument.
   * @returns vscode.CompletionItem[]
   */
  private provideArgCompletionItems(
    command: sh.Node,
    node: sh.Node,
    argIndex: number
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    return null;
  }

  /**
   * Builds a snippet from a command meta for completion items.
   * This snippet contains tab stops for the command arguments and flags.
   *
   * Flags where a Heroku App name is required will contain an enum
   * of app names derived from the git remote. Flags that specify
   * enums will present the user with a list of values to choose.
   *
   * @param commandMeta The command meta to build a snippet from.
   * @returns vscode.SnippetString
   */
  private buildSnippetFromCommandMeta(commandMeta: Command.Cached): vscode.SnippetString {
    const { id, args, flags } = commandMeta;
    const snippet = new vscode.SnippetString();
    snippet.appendText(`${commandMeta.id} `);
    const requiredArgs = args.filter((arg) => arg);

    return snippet;
  }
}
