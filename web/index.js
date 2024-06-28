import { geoffStyles, codeIcons } from "./styles.js";
import { provideVSCodeDesignSystem, vsCodeTextField, vsCodeButton } from "@vscode/webview-ui-toolkit";
import { marked } from 'marked';

provideVSCodeDesignSystem().register(vsCodeTextField(), vsCodeButton());
const vscode = acquireVsCodeApi();
class Geoff extends HTMLElement {
  #messageInput;
  #sendMessageButton;
  #chatMessagesElement;
  #formElement;

  constructor() {
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

    this.onSendMessageSubmit = this.onSendMessageSubmit.bind(this);
  }

  connectedCallback() {
    this.#messageInput = this.shadowRoot.querySelector('vscode-text-field');
    this.#sendMessageButton = this.shadowRoot.querySelector('vscode-button');
    this.#chatMessagesElement = this.shadowRoot.querySelector('#chat > ul');
    this.#formElement = this.shadowRoot.querySelector('form');

    this.#sendMessageButton.addEventListener('click', this.onSendMessageSubmit);


    window.addEventListener('message', event => {
      const htmlLiElement = document.createElement('li');
      htmlLiElement.classList.add('assistant');
      htmlLiElement.innerHTML = marked.parse(event.data.message.content);
      this.#chatMessagesElement.appendChild(htmlLiElement);
    });
  }

  async onSendMessageSubmit(event) {
    const {value} = this.#messageInput;
    if (value) {
      vscode.postMessage(value);
      const htmlLiElement = document.createElement('li');
      htmlLiElement.classList.add('user');
      htmlLiElement.textContent = value;

      this.#chatMessagesElement.appendChild(htmlLiElement);
      this.#messageInput.value = '';
    }
  }

}
customElements.define('heroku-geoff', Geoff);
