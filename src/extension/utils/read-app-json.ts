import { AppJson } from '@heroku/app-json-schema';
import { Validator, ValidatorResult } from 'jsonschema';
import vscode from 'vscode';
import * as schema from '../meta/app-json.schema.json';

/**
 * Retrieves the app.json. This file must be in the
 * root of the workspace and must be valid.
 *
 * @param workspaceRootUri The workspace uri to retrieve the file from
 * @returns The typed app.json as an object or a ValidatorResult object if validation fails.
 * @throws {Error} If the app.json cannot be read
 */
export async function readAppJson(workspaceRootUri: vscode.Uri): Promise<AppJson | ValidatorResult> {
  const appJsonUri = vscode.Uri.joinPath(workspaceRootUri, 'app.json');

  try {
    await vscode.workspace.fs.stat(appJsonUri);
  } catch (e) {
    throw new Error(`Cannot find app.json file at ${appJsonUri.path}`);
  }
  const appJsonFile = await vscode.workspace.fs.readFile(appJsonUri);
  let appJson: AppJson;
  try {
    appJson = JSON.parse(Buffer.from(appJsonFile).toString()) as AppJson;
  } catch (e) {
    throw new Error(`Cannot parse the app.json file: ${(e as Error).message}`);
  }
  const validator = new Validator();
  const result = validator.validate(appJson, schema);
  if (!result.valid) {
    return result;
  }
  return appJson;
}
