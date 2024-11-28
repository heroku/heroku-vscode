import { promisify } from 'node:util';
import vscode from 'vscode';
import { Validator, ValidatorResult } from 'jsonschema';
import AppSetupService from '@heroku-cli/schema/services/app-setup-service.js';
import { App, AppSetupCreatePayload, Build, BuildCreatePayload } from '@heroku-cli/schema';
import AppService from '@heroku-cli/schema/services/app-service.js';
import SourceService from '@heroku-cli/schema/services/source-service.js';
import BuildService from '@heroku-cli/schema/services/build-service.js';
import { herokuCommand } from '../../meta/command';
import { HerokuCommand } from '../heroku-command';
import type { AppJson } from '../../meta/app-json-schema';
import * as schema from '../../meta/app-json.schema.json';
import { logExtensionEvent, showExtensionLogs } from '../../utils/logger';
import { packSources } from '../../utils/tarball';

/**
 * The DeploymentError class is used when
 * an error occurs during the deployment of
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
  protected appService = new AppService(fetch, 'https://api.heroku.com');
  protected sourcesService = new SourceService(fetch, 'https://api.heroku.com');
  protected appSetupService = new AppSetupService(fetch, 'https://api.heroku.com');
  protected buildService = new BuildService(fetch, 'https://api.heroku.com');

  protected requestInit: RequestInit | undefined;
  protected workspaceFolder = vscode.workspace.workspaceFolders![0];
  protected rootRepoUri: vscode.Uri = this.workspaceFolder.uri;
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
   * local branch has uncommitted changes, those changes will not be reflected
   * in the deployment (obviously).
   *
   * Requirements:
   * - Valid app.json file in the workspace root
   * - Profile must exist in the workspace root
   * - Valid Heroku authentication token
   *
   * @param target (provided by VSCode) the Uri of the target file or the App object or null.
   * When a Procfile is selected, the target and the selectedFileUris contains the Procfile Uri.
   * When the app.json is selected, the target and the selectedFileUris contains the app.json Uri.
   * When an App is selected, the target contains the App object and the selectedFileUris is null.
   * @param _selections (provided by VSCode) an array of files selected. This is the same as the target unless multiple files are selected in the file explorer
   * @param rootUri The root url of the workspace.
   * @param appNames An optional list of app names for the user choose to deploy to.
   * @param tarballUri if omitted, a tarball created from the local file system will be upload to an s3 bucket and deployed to Heroku.
   *
   * @throws {Error} If authentication fails or required files are missing
   * @throws {Error} If the app.json validation fails
   * @throws {Error} If the deployment to Heroku fails
   *
   * @returns A promise that resolves when the deployment is complete
   *                         or rejects if an error occurs during deployment
   */
  public async run(
    target: vscode.Uri | App | null,
    _selections: vscode.Uri[] | null,
    rootUri: vscode.Uri = this.workspaceFolder.uri,
    appNames?: string[],
    tarballUri?: vscode.Uri
  ): Promise<void> {
    const { accessToken } = (await vscode.authentication.getSession(
      'heroku:auth:login',
      []
    )) as vscode.AuthenticationSession;
    this.requestInit = { signal: this.signal, headers: { Authorization: `Bearer ${accessToken}` } };

    logExtensionEvent(`Deploying to Heroku...`);
    this.rootRepoUri = rootUri;
    const resultPromise = vscode.window.withProgress(
      {
        title: 'Deploying to Heroku...',
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (progress, token) => {
        const cancellationPromise: Promise<void> = promisify(token.onCancellationRequested)();
        const taskPromise = (async (): Promise<(Build & { name: string }) | null> => {
          // app.json is required on an initial deployment
          if (!tarballUri && !this.isApp(target)) {
            await this.validateAppJson();
          }
          // Profile is always required when no url is given
          if (!tarballUri) {
            const hasProcfile = await this.validateProcfile();
            if (!hasProcfile) {
              logExtensionEvent(
                'Warning: No Procfile found. Heroku will attempt to automatically detect the type of application being deployed.'
              );
            }
          }
          // We're good to deploy
          const deployResult = await this.deployToHeroku(tarballUri, rootUri, appNames, target);
          progress.report({ increment: 100 });
          return deployResult;
        })();

        return Promise.race([cancellationPromise, taskPromise]);
      }
    );

    // Resolving to a falsy value indicates the user cancelled
    // rejecting means something went wrong.
    try {
      const result = await resultPromise;
      if (!result) {
        this.abort();
        const abortMessage = 'Deployment cancelled';
        logExtensionEvent(abortMessage);
        await vscode.window.showErrorMessage(abortMessage);
      } else {
        const message = `Deployment completed for newly created app: ${result.name}`;
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
        showExtensionLogs();
      }
    }
  }

  /**
   * Builds and sends the payload to Heroku for setting
   * up a new app. If a tarballUri is provided, it will be used
   * as the source_blob url. Otherwise, the AppSetup service will
   * create a new tarball and upload it to the source_blob url created
   * by the SourceService.
   *
   * - If the target argument is provided and this is an App object,
   * a new build is created and deployed to the app.
   * - If the target argument is not an App object and existing apps are found
   * in the workspace, a dialog is presented to ask the user
   * where to deploy.
   * - If the target argument is not an App object and no existing
   * apps are found in the workspace, a new app is created and deployed.
   *
   * @param tarballUri the URI of the tarball to deploy. If none
   * is provided, the AppSetup service will create a new tarball
   * and upload it to the source_blob url created by the SourceService
   * @param rootDir the root directory of the workspace. This is used to
   * determine the Procfile and app.json paths.
   * @param appNames an array of app names to display in a dialog for the user to optionally deploy to
   * @param target the target of the deployment. This can be a Uri, App or null.
   * If a tarballUri is provided, this argument is ignored.
   *
   * @returns an AppSetup object with the details of the newly setup app
   * @throws {DeploymentError} If the deployment fails
   */
  protected async deployToHeroku(
    tarballUri?: vscode.Uri,
    rootDir: vscode.Uri = this.workspaceFolder.uri,
    appNames?: string[],
    target?: unknown
  ): Promise<(Build & { name: string }) | null> {
    let blobUrl = tarballUri?.toString();

    // Create and use an amazon s3 bucket and
    // then upload the newly created tarball
    // from the local sources if no tarballUri was provided.
    if (!blobUrl) {
      const tarball = await packSources(rootDir);
      const { source_blob: sourceBlob } = await this.sourcesService.create(this.requestInit);
      blobUrl = sourceBlob.get_url;
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
        const uploadErrorMessage = `Error uploading tarball to ${blobUriBase}. The server responded with: ${response.status} - ${response.statusText}`;
        logExtensionEvent(uploadErrorMessage);
        throw new Error(uploadErrorMessage);
      }
    }
    // The user has right-clicked on a
    // Procfile or app.json or has used
    // the deploy to heroku decorator button
    // and we have apps in the remote. Ask
    // the user where to deploy.
    let isExistingDeployment = this.isApp(target);
    let targetApp = target;
    if (!isExistingDeployment) {
      if (appNames?.length) {
        const message = 'Choose where to deploy';
        const maybeAppName = await vscode.window.showQuickPick(['(Create new app)', ...appNames], { title: message });
        // User cancelled
        if (!maybeAppName) {
          return null;
        }
        // Deploy to an existing app based on the user selection
        // provided the app still exists on Heroku and the user has
        // access to it.
        if (maybeAppName !== '(Create new app)') {
          try {
            targetApp = await this.appService.info(maybeAppName, this.requestInit);
            isExistingDeployment = true;
          } catch (error) {
            const appServiceErrorMessage = `The app "${maybeAppName}" was not found on Heroku`;
            logExtensionEvent(appServiceErrorMessage);
            throw new DeploymentError(appServiceErrorMessage);
          }
        }
      }
    }
    const result = isExistingDeployment
      ? await this.createNewBuildForExistingApp(blobUrl, targetApp as App)
      : await this.setupNewApp(blobUrl);
    if (!isExistingDeployment && result) {
      // Add the new remote to the workspace
      logExtensionEvent(`Adding remote heroku-${result.name}...`);
      const app = await this.appService.info(result.name, this.requestInit);
      const gitProcess = HerokuCommand.exec(`git remote add heroku-${result.name} ${app.git_url}`, {
        cwd: rootDir.fsPath,
        signal: this.signal
      });
      const gitProcessResponse = await HerokuCommand.waitForCompletion(gitProcess);
      if (gitProcessResponse.exitCode !== 0) {
        const addRemoteErrorMessage = `Error adding remote: ${gitProcessResponse.errorMessage}`;
        logExtensionEvent(addRemoteErrorMessage);
      }
    }
    return result;
  }

  /**
   * Checks for the existence of the Procfile.
   *
   * @returns boolean indicating wether a Procfile was found
   * @throws {Error} If the Procfile is missing or invalid
   */
  protected async validateProcfile(): Promise<boolean> {
    try {
      const procFileUri = vscode.Uri.joinPath(this.rootRepoUri, 'Procfile');
      await vscode.workspace.fs.stat(procFileUri);
    } catch {
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
   * @returns The typed app.json as an object or a ValidatorResult object if validation fails.
   * @throws {Error} If the app.json cannot be read
   */
  protected async readAppJson(): Promise<AppJson | ValidatorResult> {
    const appJsonUri = vscode.Uri.joinPath(this.rootRepoUri, 'app.json');

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

  /**
   * Creates a new build for the given appIdentity.
   * This function is used when creating a new build
   * for an existing app.
   *
   * @param blobUrl The url of the blob to sent to the app setup service
   * @param app The App object to create the build for
   * @returns Build object with the details of the newly created build
   * @throws {DeploymentError} If the deployment fails
   */
  private async createNewBuildForExistingApp(blobUrl: string, app: App): Promise<Build & { name: string }> {
    const payload: BuildCreatePayload = {
      // eslint-disable-next-line camelcase
      source_blob: {
        url: blobUrl,
        checksum: null,
        version: null,
        // eslint-disable-next-line camelcase
        version_description: null
      }
    };

    try {
      const result = await this.buildService.create(app.id, payload, this.requestInit);
      const info = await this.buildService.info(app.id, result.id, this.requestInit);
      if (info.status === 'failed') {
        throw new DeploymentError(
          `The request was sent to Heroku successfully but there was a problem with deployment: ${info.status}`,
          app.name
        );
      }
      return { ...info, name: app.name };
    } catch (error) {
      throw new DeploymentError((error as Error).message);
    }
  }

  /**
   * Sets up a new app using the AppSetup service and the
   * supplied blobUrl.
   *
   * @param blobUrl The url of the blob to sent to the app setup service
   * @returns Build object with the details of the newly setup app
   * @throws {DeploymentError} If the deployment fails
   */
  private async setupNewApp(blobUrl: string): Promise<Build & { name: string }> {
    const payload: AppSetupCreatePayload = {
      // eslint-disable-next-line camelcase
      source_blob: {
        url: blobUrl
      }
    };
    try {
      const result = await this.appSetupService.create(payload, this.requestInit);
      const info = await this.appSetupService.info(result.id, this.requestInit);
      if (info.failure_message) {
        logExtensionEvent(`Post deployment failed: ${info.failure_message}`);
        throw new DeploymentError(
          `The request was sent to Heroku successfully but there was a problem with deployment: ${info.failure_message}`,
          result.app.id
        );
      }
      return { ...(info.build as Build), name: result.app.name };
    } catch (error) {
      throw new DeploymentError((error as Error).message);
    }
  }

  /**
   * Determines if the target is an App object.
   *
   * @param target The object to test.
   * @returns true if the target object is an App object, false otherwise
   */
  private isApp(target: unknown): target is App {
    return !!target && typeof target === 'object' && 'id' in target && 'name' in target;
  }
}
