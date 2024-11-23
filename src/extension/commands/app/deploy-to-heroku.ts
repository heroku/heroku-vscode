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
import { packSources } from '../../utils/tarball';

/**
 * The DeploymentError class is used when
 * an error occurs during the deplomen of
 * an app.
 */
class DeploymentError extends Error {
  /**
   * Constructs a new DeploymentError
   *
   * @param message The message related to the error
   * @param appId The app ID if available
   */
  public constructor(
    message: string,
    public appId?: string
  ) {
    super(message);
  }
}

@herokuCommand()
/**
 * Handles deployment of VSCode workspace projects to Heroku.
 *
 * This command-based class manages the entire deployment workflow including:
 * - Authentication with Heroku
 * - Validation of project configuration (app.json)
 * - Application creation and deployment via Heroku's AppSetup API
 * - Git remote configuration for the new Heroku app
 *
 * The deployment process uses Heroku's source blob URL approach, which requires
 * a publicly accessible tarball of the repository. Local uncommitted changes
 * will be included in the deployment unless a blobUri is specified.
 *
 * Usage:
 * ```typescript
 * await vscode.commands.executeCommand(DeployToHeroku.COMMAND_ID);
 * ```
 *
 * appSetupService - Service for Heroku app setup operations
 * appService - Service for Heroku app management
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
   * 1. Determines if the app.json configuration file exists and is valid
   * 2. Determines if the the Procfile exists
   * 2. Creates and deploys a new Heroku application
   *
   * The deployment process is displayed in a progress notification that can be cancelled
   * by the user. Upon successful deployment, the new app is added to the git
   * remote and the user is notified with options to view the app in the explorer
   *
   * Note that the AppSetupService requires a URL to download a tarball. If
   * the blobUri argument is provided (such as the git repo's archive link) and the
   * localbranch has uncommitted changes, those changes will not be reflected
   * in the deployment (obviously).
   *
   * Requirements:
   * - Valid app.json file in the workspace root
   * - Profile must exist in the workspace root
   * - Valid Heroku authentication token
   *
   * @param _fileUri (proided by VSCode) the Uri of the target file
   * @param _selectedFileUris (proided by VSCode) an array of files selected. This is the same as the fileUri unless multiple files are selected in the file explorer
   * @param validateAppJson when true, requires the app.json file to exist and be valid
   * @param tarballUri if omitted, a tarball created from the local file system will be upload to an s3 bucket.
   *
   * @throws {Error} If authentication fails or required files are missing
   * @throws {Error} If the app.json validation fails
   * @throws {Error} If the deployment to Heroku fails
   *
   * @returns A promise that resolves when the deployment is complete
   *                         or rejects if an error occurs during deployment
   */
  public async run(
    _fileUri: vscode.Uri | null,
    _selectedFileUris: vscode.Uri[] | null,
    validateAppJson = true,
    tarballUri?: vscode.Uri
  ): Promise<void> {
    const { accessToken } = (await vscode.authentication.getSession(
      'heroku:auth:login',
      []
    )) as vscode.AuthenticationSession;
    this.requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    logExtensionEvent(`Deploying to Heroku...`);
    const resultPromise = vscode.window.withProgress(
      {
        title: 'Deploying to Heroku...',
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (progess, token) => {
        const cancellationPromise: Promise<void> = promisify(token.onCancellationRequested)();

        const taskPromise = (async (): Promise<AppSetup | undefined> => {
          // app.json is required on an initial deployment
          if (validateAppJson || !tarballUri) {
            await this.validateAppJson();
          }
          // Profile is always required
          await this.validateProcfile();
          // We're good to deploy
          const deployResult = await this.deployToHeroku(tarballUri);
          progess.report({ increment: 100 });
          return deployResult;
        })();

        return Promise.race([cancellationPromise, taskPromise]);
      }
    );

    try {
      const result = await resultPromise;
      if (result === undefined) {
        this.abort();
        logExtensionEvent(`Deployment cancelled`);
      } else {
        const message = `Deployment completed for newly createed app: ${result.app.name}`;
        logExtensionEvent(message);
        const response = await vscode.window.showInformationMessage(message, 'OK', 'View app');
        if (response === 'View app') {
          await vscode.commands.executeCommand('workbench.view.extension.heroku');
        }
      }
    } catch (error) {
      const message = (error as Error).message;
      logExtensionEvent(`Deployment failed: ${message}`);
      const response = await vscode.window.showErrorMessage(`Deployment failed: ${message}`, 'OK', 'View logs');
      if (response === 'View logs') {
        showExtenionLogs();
      }
    }
  }

  /**
   * Builds and sends the payload to Heroku for setting
   * up a new app.
   *
   * @param tarbalUri the URI of the tarball to deploy. If none
   * is provided, the AppSetup service will create a new tarball
   * and upload it to the souce_blob url created by the SourceService
   *
   * @returns an AppSetup object with the details of the newly setup app
   * @throws {DeploymentError} If the deployment fails
   */
  protected async deployToHeroku(tarbalUri?: vscode.Uri): Promise<AppSetup> {
    let blobUri = tarbalUri?.toString();

    // Create and use an amazon s3 bucket and
    // then upload the newly created tarball
    // from the local sources if no blobUri was provided.
    if (!blobUri) {
      const tarball = await packSources(vscode.workspace.workspaceFolders![0]);
      const { source_blob: sourceBlob } = await this.sourcesService.create(this.requestInit);
      blobUri = sourceBlob.get_url;
      // trim off the s3 bucket key and signature
      const blobUriBase = vscode.Uri.parse(sourceBlob.put_url).with({ query: '' }).toString();
      logExtensionEvent(`Attempting to upload tarball to ${blobUriBase}`);
      logExtensionEvent(`Tarball size: ${tarball.byteLength} bytes`);
      const response = await fetch(sourceBlob.put_url, {
        signal: this.signal,
        method: 'PUT',
        body: tarball
      });

      if (response.ok) {
        logExtensionEvent(`Successfully uploaded tarball to ${blobUriBase}`);
      } else {
        const message = `Error uploading tarball to ${blobUriBase}`;
        logExtensionEvent(message);
        throw new Error(message);
      }
    }

    const payload: AppSetupCreatePayload = {
      // eslint-disable-next-line camelcase
      source_blob: {
        url: blobUri
      }
    };

    const result = await this.appSetupService.create(payload, this.requestInit);
    if (result) {
      const info = await this.appSetupService.info(result.id, this.requestInit);
      if (info.failure_message) {
        logExtensionEvent(`Post deployment failed: ${info.failure_message}`);
        throw new DeploymentError(
          `The request was sent to Heroku successfully but there was a problem with deployment: ${info.failure_message}`,
          result.app.id
        );
      }
      // Add the new remote to the workspace
      logExtensionEvent(`Adding remote heroku-${result.app.name}...`);
      const app = await this.appService.info(result.app.id, this.requestInit);
      const rootRepository = await getRootRepository();
      if (!rootRepository) {
        logExtensionEvent(
          'Git repository not found. The app deployed successfully but the Git remotes were not updated'
        );
      }
      await rootRepository?.addRemote(`heroku-${result.app.name}`, app.git_url);
    }
    return result;
  }

  /**
   * Checks for the existence of the Procfile. If unavailable,
   * the user is notified and the action is aborted.
   *
   * @returns true if the workspace is valid, throws otherwise
   * @throws {Error} If the Procfile is missing or invalid
   */
  protected async validateProcfile(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.procFileUri);
    } catch {
      throw new Error('No Procfile found. Deployment cannot continue.');
    }
    return true;
  }
  /**
   * Reads and validates the app.json. If it is invalid,
   * the errors are logged and the user is informed that
   * the app will not be deployed and the action is aborted.
   *
   * @returns The app.json as an object or undefined if it is invalid
   * @throws {Error} If the app.json is invalid or cannot be read
   */
  protected async validateAppJson(): Promise<AppJson | undefined> {
    const readAppJsonResult: AppJson | ValidatorResult = await this.readAppJson();
    if (readAppJsonResult instanceof ValidatorResult) {
      logExtensionEvent(`The following errors were found in app.json:`);
      logExtensionEvent(`--------------------------------`);
      readAppJsonResult.errors.forEach((error) => {
        logExtensionEvent(error.stack);
      });
      logExtensionEvent(`--------------------------------`);
      throw new Error('invalid app.json');
    }
    return readAppJsonResult;
  }

  /**
   * Retrieves the app.json. This file must be in the
   * root of the workspace and must be valid.
   *
   * @returns The typed app.json as an object or a ValidatorResult object if validaton fails.
   * @throws {Error} If the app.json cannot be read
   */
  protected async readAppJson(): Promise<AppJson | ValidatorResult> {
    try {
      await vscode.workspace.fs.stat(this.appJsonUri);
    } catch (e) {
      throw new Error(`Cannot find app.json file at ${this.appJsonUri.path}`);
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
}
