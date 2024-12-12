import { EnvironmentVariables } from '@heroku/app-json-schema';

export type DeployPayload = {
  appName: string | undefined;
  repoUrl: string | undefined;
  repoName: string | undefined;
  teamId: string | undefined;
  spaceId: string | undefined;
  internalRouting: boolean;
  env: EnvironmentVariables;
};
