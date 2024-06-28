import vscode from 'vscode';
import { GetLLMUrl } from '../commands/config/get-llm-url';
export class WebviewProvider implements vscode.WebviewViewProvider {

  private baseURL: string | undefined;
  private apiKey: string | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    const onDiskPath = vscode.Uri.joinPath(this.context.extensionUri, 'web', 'index.js');
    const indexPath = webviewView.webview.asWebviewUri(onDiskPath);
    const stylesPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'web', 'styles.js'));

    webviewView.webview.options = { enableScripts: true, localResourceRoots: [
      vscode.Uri.joinPath(this.context.extensionUri, 'web'),
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules')
    ]};

    const fastPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@microsoft/fast-foundation/dist/esm/index.js'));
    const fastElementPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@microsoft/fast-element/dist/esm/index.js'));
    const fastWebUtils = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@microsoft/fast-web-utilities/dist/index.js'));
    const toolkitPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@vscode/webview-ui-toolkit/dist/index.js'));
    const tslibPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/tslib/tslib.es6.mjs'));
    const exenvPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/exenv-es6/dist/index.js'));
    const tabbablePath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/tabbable/dist/index.esm.js'));
    const markedPath = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/marked/lib/marked.esm.js'));
    const codiconsUri = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    webviewView.webview.html = `
    <html style="height: 100%;">
    <head>
      <script type="importmap">
      {
        "imports": {
          "tslib": "${tslibPath}",
          "exenv-es6": "${exenvPath}",
          "marked": "${markedPath}",
          "tabbable": "${tabbablePath}",
          "@microsoft/fast-web-utilities": "${fastWebUtils}",
          "@microsoft/fast-element": "${fastElementPath}",
          "@microsoft/fast-foundation": "${fastPath}",
          "@vscode/webview-ui-toolkit": "${toolkitPath}"
        }
      }
      </script>

      <script type="module">
        import {initCodeIcons} from '${stylesPath}';
        void initCodeIcons("${codiconsUri}");
      </script>

      <script type="module" src="${indexPath}"></script>
    </head>
      <body style="min-height: 100%; display: flex;">
        <heroku-geoff>Geoff is not loaded.</heroku-geoff>
      </body>
    </html>`;

    const llmInfo = await vscode.commands.executeCommand<{apiKey: string, baseURL: string} | null>(GetLLMUrl.COMMAND_ID, undefined, "boiling-eyrie-93427");
    this.apiKey = llmInfo?.apiKey;
    this.baseURL = llmInfo?.baseURL;
    this.watchWebViewForMessages(webviewView.webview);
  }

  public watchWebViewForMessages(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(async message => {
      const response = await this.postToGeoff(message);
      webview.postMessage(response?.choices[0]);
    });
  }

  public async postToGeoff(message: string): Promise<Record<string, string> | null> {
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${this.apiKey}`);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      headers,
      method: 'POST',
      body: JSON.stringify({
        "model": "mixtral-8x7b",
        // "max_tokens": 1400,
        "messages": [
          {
            "role": "user",
            "content": message
          }
        ]
      })
    });

    if (response.ok) {
      return await response.json() as Record<string, string>;
    }

    return null;
  }
}
