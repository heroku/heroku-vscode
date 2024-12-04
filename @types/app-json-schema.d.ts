/**
 * Represents the root configuration for a Heroku application.
 * This schema defines the structure of an app.json file which is used to
 * configure Heroku applications for deployment and review apps.
 */
export type AppJson = {
  name?: string;
  description?: string;
  keywords?: string[];
  website?: string;
  repository?: string;
  logo?: string;
  success_url?: string;
  scripts?: Scripts;
  env?: EnvironmentVariables;
  formation?: Formation;
  addons?: Addon[];
  buildpacks?: Buildpack[];
  environments?: Environments;
  stack?: HerokuStack;
  image?: string;
};

/**
 * Defines scripts that run at specific lifecycle events during deployment.
 */
export type Scripts = {
  postdeploy?: string;
  'pr-predestroy'?: string;
};

/**
 * Represents a single environment variable configuration.
 */
export type EnvironmentVariable = {
  description?: string;
  value?: string;
  required?: boolean;
  generator?: 'secret';
};

/**
 * Maps environment variable names to their configurations.
 */
export type EnvironmentVariables = {
  [key: string]: EnvironmentVariable;
};

/**
 * Defines the configuration for a specific process type in the application.
 */
export type DynoFormation = {
  quantity: number;
  size?: DynoSize;
};

/**
 * Maps process types to their dyno formations.
 */
export type Formation = {
  [key: string]: DynoFormation;
};

/**
 * Represents the available dyno sizes in Heroku.
 */
export type DynoSize =
  | 'free'
  | 'eco'
  | 'hobby'
  | 'basic'
  | 'standard-1x'
  | 'standard-2x'
  | 'performance-m'
  | 'performance-l'
  | 'private-s'
  | 'private-m'
  | 'private-l'
  | 'shield-s'
  | 'shield-m'
  | 'shield-l';

/**
 * Detailed configuration for a Heroku addon.
 */
export type AddonConfig = {
  plan: string;
  as?: string;
  options?: Record<string, unknown>;
};

/**
 * Represents a Heroku addon.
 */
export type Addon = string | AddonConfig;

/**
 * Defines a buildpack configuration for the application.
 */
export type Buildpack = {
  url: string;
};

/**
 * Base configuration for different environments.
 */
export type EnvironmentConfig = {
  env?: EnvironmentVariables;
  formation?: Formation;
  addons?: Addon[];
  buildpacks?: Buildpack[];
};

/**
 * Configuration specific to test environments.
 */
export type TestEnvironment = EnvironmentConfig & {
  scripts?: {
    test?: string;
  };
};

/**
 * Contains environment-specific configurations.
 */
export type Environments = {
  test?: TestEnvironment;
  review?: EnvironmentConfig;
  production?: EnvironmentConfig;
};

/**
 * Represents the available Heroku stack versions.
 */
export type HerokuStack = 'heroku-18' | 'heroku-20' | 'heroku-22' | 'heroku-24';
