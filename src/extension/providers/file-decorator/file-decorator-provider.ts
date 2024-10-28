import { Dyno } from '@heroku-cli/schema';
import * as vscode from 'vscode';

/**
 * The FildeDecoratorProvider is responsible for providing file decorations
 * for Resources in the resource explorer.
 *
 * This includes status indicators for Dyno health.
 *
 */
export class FildeDecoratorProvider
  extends vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>
  implements vscode.FileDecorationProvider
{
  /**
   * @inheritdoc
   */
  public onDidChangeFileDecorations = this.event;

  /**
   * Mapping of Dyno states to file decorations.
   */
  public stateToDecorator: Record<Dyno['state'], vscode.FileDecoration> = {
    up: { badge: '🟢', tooltip: 'Dyno is up' },
    provisioning: { badge: '🔵', tooltip: 'Dyno is provisioning' },
    idle: { badge: '🟡', tooltip: 'Dyno is idle' },
    stopping: { badge: '🟡', tooltip: 'Dyno is stopping' },
    starting: { badge: '🟡', tooltip: 'Dyno is starting' },
    down: { badge: '🔴', tooltip: 'Dyno is down' },
    crashed: { badge: '🔴', tooltip: 'Dyno has crashed' }
  };

  /**
   * Constructor for the FileDecoratorProvider.
   *
   * @param context The extension context provided by VSCode.
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    super();
  }

  /**
   * Provide a file decoration for the given resource.
   *
   * @param uri The URI of the resource to decorate.
   * @returns The file decoration for the resource, or null if no decoration is provided.
   */
  public provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme === 'heroku') {
      const [, kind, state] = uri.path.split('/');

      return kind === 'dyno' ? this.stateToDecorator[state] : null;
    }
    return null;
  }
}
