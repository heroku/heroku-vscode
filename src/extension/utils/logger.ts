import { getOutputChannel, HerokuOutputChannel } from '../meta/command';

const logger = getOutputChannel({
  outputChannelId: HerokuOutputChannel.ExtensionDebugLogs,
  languageId: 'heroku-logs'
})!;

/**
 * Logs arbitrary info to the output channel
 *
 * @param message The message to write to the output channel
 */
export function logExtensionEvent(message: string): void {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const messageWithTimestamp = `[${timestamp}] heroku[vscode] ${message}`;
  logger.appendLine(messageWithTimestamp);
}

/**
 * Shows the output channel
 */
export function showExtenionLogs(): void {
  logger.show();
}
