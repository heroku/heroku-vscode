
const geoffStyles = new CSSStyleSheet();
geoffStyles.replaceSync(`
  :host {
    display: flex;
    flex-flow: column;
    width: 100%;
  }

  #chat {
    height: 100%;
  }
  #chat > ul {
    height: inherit;
    list-style: none;

    display: flex;
    flex-flow: column;
    justify-content: end;

    padding: 0;
    margin: 0;
  }
  #chat > ul > li {
    margin: 10px 10px 10px 30px;
    border: calc(var(--border-width) * 1px) var(--panel-view-border) solid;
    border-radius: 5px;
    align-self: flex-end;
    padding: 5px;
    max-width: calc(100% - 30px);
    overflow: auto;
  }
  #chat > ul > li.assistant {
    align-self: flex-start;
    border: calc(var(--border-width) * 1px) var(--vscode-textBlockQuote-border) solid;
    margin-right: 30px;
  }
  #chat > ul > li:hover {
    background-color: var(--list-hover-background);
  }

  #message-toolbar {
    display: flex;
    margin-bottom: 10px;
  }
  vscode-text-field {
    margin-right: 5px;
    width: 100%;
  }
`);
export { geoffStyles };

export const codeIcons = new CSSStyleSheet();
export const initCodeIcons = async (uri) => {
  const result = await fetch(uri);
  if (result.ok){
    const stylesText = await result.text();
    codeIcons.replaceSync(stylesText);
  }
};
