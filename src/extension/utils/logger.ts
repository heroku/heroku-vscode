import { getOutputChannel, HerokuOutputChannel } from '../meta/command';

const logger = getOutputChannel({
  outputChannelId: HerokuOutputChannel.ExtensionDebugLogs,
  languageId: 'heroku-logs'
})!;

/**
 * Logs arbitrary info to the output channel
 *
 * @param message The message to write to the output channel
 * @param process The process that is logging the message. default is 'vscode'
 */
export function logExtensionEvent(message: string, process = 'vscode'): void {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const messageWithTimestamp = `[${timestamp}] heroku[${process}] ${message}`;
  logger.appendLine(messageWithTimestamp);
}

/**
 * Shows the output channel
 */
export function showExtensionLogs(): void {
  logger.show();
}
