import { exec } from "node:child_process";
import { HerokuCommand } from "../heroku-command";
import { herokuCommand } from "../../meta/command";

@herokuCommand
export class GetLLMUrl extends HerokuCommand<{ baseURL: string, apiKey: string } | null> {
  public static COMMAND_ID = 'heroku:get:llm:url' as const;

  public async run(appId: string): Promise<{baseURL: string, apiKey:string} | null> {
    using cliTokenProcess = exec(`heroku config:get LLM_URL -a ${appId}`, { signal: this.signal });
    const { exitCode, output } = await HerokuCommand.waitForCompletion(cliTokenProcess);

    if (exitCode === 0 && output) {
      const apiKey = output.split('@')[0].split('//')[1];  // Get the key part before '@'
      const baseURL = 'https://' + output.trim().split('@')[1] + '/v1';
      return {baseURL, apiKey}
    }
    return null;
  }
}
