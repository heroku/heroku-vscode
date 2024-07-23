import { provideVSCodeDesignSystem, vsCodeTextField, vsCodeButton } from "@vscode/webview-ui-toolkit";
import { marked } from 'marked';
import { geoffStyles, codeIcons } from "./styles.js";

provideVSCodeDesignSystem().register(vsCodeTextField(), vsCodeButton());
const vscode = acquireVsCodeApi();
class Geoff extends HTMLElement {
  #messageInput: HTMLInputElement;
  #sendMessageButton: HTMLButtonElement;
  #chatMessagesElement: HTMLUListElement;

  public constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [geoffStyles, codeIcons];
    shadow.innerHTML = `
      <div id="chat">
        <ul role="presentation"></ul>
      </div>
      <form id="message-toolbar">
        <vscode-text-field></vscode-text-field>
        <vscode-button type="submit">Send</vscode-button>
      </form>
    `;

    this.#messageInput = shadow.querySelector('vscode-text-field') as HTMLInputElement;
    this.#sendMessageButton = shadow.querySelector('vscode-button') as HTMLButtonElement;
    this.#chatMessagesElement = shadow.querySelector('#chat > ul') as HTMLUListElement;
  }

  public connectedCallback(): void {
    this.#sendMessageButton?.addEventListener('click', this.onSendMessageSubmit);

    window.addEventListener('message', (event: MessageEvent<{message:{content: string}}>) => {
      const htmlLiElement = document.createElement('li');
      htmlLiElement.classList.add('assistant');
      htmlLiElement.innerHTML = marked.parse(event.data.message.content, {async: false}) as string;
      this.#chatMessagesElement?.appendChild(htmlLiElement);
    });
  }

  private onSendMessageSubmit = (event: SubmitEvent | MouseEvent): void => {
    event.preventDefault();
    const {value} = this.#messageInput;
    if (value) {
      vscode.postMessage(value);
      const htmlLiElement = document.createElement('li');
      htmlLiElement.classList.add('user');
      htmlLiElement.textContent = value;

      this.#chatMessagesElement.appendChild(htmlLiElement);
      this.#messageInput.value = '';
    }
  };
}
customElements.define('heroku-geoff', Geoff);
