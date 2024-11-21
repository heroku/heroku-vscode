import { promisify } from 'node:util';
import vscode from 'vscode';
import { Validator, ValidatorResult } from 'jsonschema';
import AppSetupService from '@heroku-cli/schema/services/app-setup-service.js';
import { AppSetup, AppSetupCreatePayload } from '@heroku-cli/schema';
import AppService from '@heroku-cli/schema/services/app-service.js';
import SourceService from '@heroku-cli/schema/services/source-service.js';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import type { AppJson } from '../../meta/app-json-schema';
import * as schema from '../../meta/app-json.schema.json';
import { getRootRepository } from '../../utils/git-utils';
import { logExtensionEvent, showExtenionLogs } from '../../utils/logger';
import { Branch } from '../../git';
import { packSources } from '../../utils/tarball';

@herokuCommand()
/**
 * Handles deployment of VS Code workspace projects to Heroku.
 *
 * This command-based class manages the entire deployment workflow including:
 * - Authentication with Heroku
 * - Validation of project configuration (app.json)
 * - Git repository validation and status checks
 * - Application creation and deployment via Heroku's AppSetup API
 * - Git remote configuration for the new Heroku app
 *
 * The deployment process uses Heroku's source blob URL approach, which requires
 * a publicly accessible tarball of the repository. Local uncommitted changes
 * will not be included in the deployment.
 *
 * Usage:
 * ```typescript
 * await vscode.commands.executeCommand(DeployToHeroku.COMMAND_ID);
 * ```
 *
 * appSetupService - Service for Heroku app setup operations
 *
 * appService - Service for Heroku app management
 *
 * requestInit - HTTP request configuration for Heroku API calls
 *
 * @see {@link HerokuCommand}
 * @see {@link AppSetupService}
 * @see {@link AppService}
 */
export class DeployToHeroku extends HerokuCommand<void> {
  public static COMMAND_ID = 'heroku:deploy-to-heroku';
  protected appSetupService = new AppSetupService(fetch, 'https://api.heroku.com');
  protected appService = new AppService(fetch, 'https://api.heroku.com');
  protected sourcesService = new SourceService(fetch, 'https://api.heroku.com');

  protected requestInit: RequestInit | undefined;
  protected workspaceFolder = vscode.workspace.workspaceFolders![0];
  protected appJsonUri = vscode.Uri.joinPath(this.workspaceFolder.uri, 'app.json');
  protected procFileUri = vscode.Uri.joinPath(this.workspaceFolder.uri, 'Procfile');
  /**
   * Deploys the current workspace to Heroku by means
   * of the AppSetup apis.
   *
   * This function orchestrates the following steps:
   * 1. Validates the app.json configuration file
   * 2. Checks git repository status and branch conditions - if a
   * dirty local branch is detected, the user is notified and asked to cancel or continue.
   * 3. Creates and deploys a new Heroku application
   *
   * The deployment process is displayed in a progress notification that can be cancelled
   * by the user. Upon successful deployment, the new app is added to the git
   * remote and the user is notified with options to view the app in the explorer
   *
   * Note that the AppSetup requires a URL to download a tar ball which
   * this command uses the git repo's archive link for this purpose. If a local
   * branch has uncommitted changes, those changes will not be reflected
   * in the deployment.
   *
   * Requirements:
   * - Valid app.json file in the workspace root
   * - Initialized git repository
   * - Valid Heroku authentication token
   *
   * @throws {Error} If authentication fails or required files are missing
   * @throws {Error} If the app.json validation fails
   * @throws {Error} If the deployment to Heroku fails
   *
   * @returns A promise that resolves when the deployment is complete
   *                         or rejects if an error occurs during deployment
   */
  public async run(): Promise<void> {
    const { accessToken } = (await vscode.authentication.getSession(
      'heroku:auth:login',
      []
    )) as vscode.AuthenticationSession;
    this.requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    logExtensionEvent(`Deploying to Heroku...`);
    const result = await vscode.window.withProgress(
      {
        title: 'Deploying to Heroku...',
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (progess, token) => {
        const cancellationPromise: Promise<void> = promisify(token.onCancellationRequested)();

        const taskPromise = (async (): Promise<AppSetup | undefined> => {
          const appJson = await this.validateAndReturnAppJson();
          if (!appJson) {
            return;
          }
          const isValidWorkspace = await this.validateWorkspace();
          if (!isValidWorkspace) {
            return;
          }
          // We're good to deploy
          const deployResult = await this.deployToHeroku();
          progess.report({ increment: 100 });
          return deployResult;
        })();

        return Promise.race([cancellationPromise, taskPromise]);
      }
    );

    if (result === undefined) {
      logExtensionEvent(`Deployment cancelled`);
    } else {
      const message = `Deployment completed for newly createed app: ${result.app.name}`;
      logExtensionEvent(message);
      const response = await vscode.window.showInformationMessage(message, 'OK', 'View app');
      if (response === 'View app') {
        await vscode.commands.executeCommand('workbench.view.extension.heroku');
      }
    }
  }

  /**
   * Builds and sends the payload to Heroku for setting
   * up a new app.
   *
   * @returns an AppSetup object with the details of the newly setup app
   */
  protected async deployToHeroku(): Promise<AppSetup> {
    const tarball = await packSources(vscode.workspace.workspaceFolders![0]);

    const { source_blob: sourceBlob } = await this.sourcesService.create(this.requestInit);
    const blobUri = sourceBlob.put_url;
    logExtensionEvent(`Tarball size: ${tarball.byteLength} bytes`);
    logExtensionEvent(`Attempting to upload tarball to ${blobUri}`);
    const response = await fetch(blobUri, {
      method: 'PUT',
      body: tarball
    });

    if (response.ok) {
      logExtensionEvent(`Successfully uploaded tarball to ${blobUri}`);
    } else {
      const message = `Error uploading tarball to ${blobUri}`;
      logExtensionEvent(message);
      throw new Error(message);
    }

    const payload: AppSetupCreatePayload = {
      // eslint-disable-next-line camelcase
      source_blob: {
        url: sourceBlob.get_url
      }
    };

    try {
      const result = await this.appSetupService.create(payload, this.requestInit);
      if (result) {
        const app = await this.appService.info(result.app.id, this.requestInit);
        const rootRepository = await getRootRepository();
        await rootRepository!.addRemote(`heroku-${result.app.name}`, app.git_url);
      }
      return result;
    } catch (error) {
      logExtensionEvent(`Error deploying to Heroku: ${(error as Error).message}`);
      const errorDeployingResponse = await vscode.window.showErrorMessage(
        'Error deploying to Heroku',
        'OK',
        'View logs'
      );
      if (errorDeployingResponse === 'View logs') {
        showExtenionLogs();
      }
      throw error;
    }
  }

  /**
   * Validates the workspace and ensures the
   * ap.json and Procfile are present. If not,
   * the user is notified and the action is aborted.
   *
   * @returns true if the workspace is valid, false otherwise
   */
  protected async validateWorkspace(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.appJsonUri);
    } catch {
      await vscode.window.showErrorMessage('Nn app.json file found. Deployment cannot continue', 'OK');
    }
    try {
      await vscode.workspace.fs.stat(this.procFileUri);
    } catch {
      await vscode.window.showErrorMessage('No Procfile found. Deployment cannot continue', 'OK');
    }
    // The user has no git repo initialized in this
    // workspace. Since Heroku requires a location
    // to get the tarball from during deployment, we
    // must make this a hard requirement.
    const rootRepository = await getRootRepository();
    if (!rootRepository) {
      logExtensionEvent(`${this.workspaceFolder.uri.path} is not a Git repository`);
      const response = await vscode.window.showErrorMessage(
        'This project is not a git repository. Deployment cannot continue',
        'OK',
        'View logs'
      );
      if (response === 'View logs') {
        showExtenionLogs();
      }
      return false;
    }
    return true;
  }
  /**
   * Reads and validates the app.json. If it is invalid,
   * the errors are logged and the user is informed that
   * the app will not be deployed and the action is aborted.
   *
   * @returns The app.json as an object or undefined if it is invalid
   */
  protected async validateAndReturnAppJson(): Promise<AppJson | undefined> {
    let readAppJsonResult: AppJson | ValidatorResult;
    try {
      readAppJsonResult = await this.readAppJson();
    } catch (e) {
      return undefined;
    }
    if (readAppJsonResult instanceof ValidatorResult) {
      logExtensionEvent(`Cannot deploy to Heroko due to the following errors in app.json:`);
      logExtensionEvent(`--------------------------------`);
      readAppJsonResult.errors.forEach((error) => {
        logExtensionEvent(error.message);
      });
      logExtensionEvent(`--------------------------------`);
      const response = await vscode.window.showErrorMessage(
        'The app.json file is invalid. View log output for more details',
        'OK',
        'View logs'
      );
      if (response === 'View logs') {
        showExtenionLogs();
      }
      return;
    }
    return readAppJsonResult;
  }

  /**
   * Retrieves the app.json. This file must be in the
   * root of the workspace and must be valid.
   *
   * @returns The typed app.json as an object
   */
  protected async readAppJson(): Promise<AppJson | ValidatorResult> {
    try {
      await vscode.workspace.fs.stat(this.appJsonUri);
    } catch (e) {
      const message = `Cannot find app.json file at ${this.appJsonUri.path}`;
      logExtensionEvent(message);
      throw new Error(message);
    }
    const appJsonFile = await vscode.workspace.fs.readFile(this.appJsonUri);
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

  /**
   * Informs the user that uncommitted changes will not
   * be deployed and asks if they want to continue anyway.
   *
   * @param branch The current branch
   * @param appJsonChanged Whether the app.json was changed in the current branch
   *
   * @returns boolean if the user wants to continue
   */
  protected async askToContinueWithDirtyBranch(branch: Branch | undefined, appJsonChanged: boolean): Promise<boolean> {
    let message = branch ? `Your local branch does not match origin/${branch.name}. ` : '';
    message += appJsonChanged ? 'The app.json file has been changed. ' : '';
    message += 'Uncommitted changes will not be deployed to Heroku. ';
    message += 'Do you want to continue anyway?';

    const result = await vscode.window.showWarningMessage(message, 'Yes', 'No');
    return result === 'Yes';
  }
}
