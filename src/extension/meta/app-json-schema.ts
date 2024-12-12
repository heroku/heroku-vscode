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
 * These scripts run in a one-off dyno and can be used for database migrations,
 * seeding data, or other setup tasks.
 */
export type Scripts = {
  postdeploy?: string;
  'pr-predestroy'?: string;
};

/**
 * Represents a single environment variable configuration.
 * Used to define how an environment variable should be handled during deployment.
 */
export type EnvironmentVariable = {
  description?: string;
  value?: string;
  required?: boolean;
  generator?: 'secret';
};

/**
 * Maps environment variable names to their configurations.
 * Used to specify all environment variables needed by the application.
 */
export type EnvironmentVariables = {
  [key: string]: EnvironmentVariable;
};

/**
 * Defines the configuration for a specific process export type in the application.
 * Specifies how many instances should run and what size they should be.
 */
export type DynoFormation = {
  quantity: number; // Required when formation is specified
  size?: DynoSize;
};

/**
 * Maps process types to their dyno formations.
 * Used to specify the execution environment for different parts of the application.
 */
export type Formation = {
  [key: string]: DynoFormation;
};

/**
 * Represents the available dyno sizes in Heroku.
 * These determine the computational and memory resources available to each process.
 */
export type DynoSize =
  | 'free'
  | 'eco'
  | 'hobby'
  | 'basic'
  | 'standard-1x'
  | 'standard-2x'
  | '1x-classic'
  | '2x-classic'
  | 'private-s'
  | 'private-m'
  | 'private-l'
  | 'private-l-ram'
  | 'private-xl'
  | 'private-2xl'
  | 'performance'
  | 'performance-m'
  | 'performance-l'
  | 'performance-l-ram'
  | 'performance-xl'
  | 'performance-2xl'
  | 'shield-s'
  | 'shield-m'
  | 'shield-l'
  | 'shield-xl'
  | 'shield-2xl';

/**
 * Detailed configuration for a Heroku addon.
 * Used when additional configuration beyond the plan name is needed.
 */
export type AddonConfig = {
  plan: string; // Required when using object form
  as?: string;
  options?: Record<string, string | number | boolean | null>;
};

/**
 * Represents a Heroku addon, either as a simple plan name string
 * or a detailed configuration object.
 */
export type Addon = string | AddonConfig;

/**
 * Defines a buildpack configuration for the application.
 * Buildpacks are responsible for transforming deployed code into a slug.
 */
export type Buildpack = {
  url: string; // Required
};

/**
 * Configuration specific to test environments.
 * Used to define special configurations for testing purposes.
 */
export type TestEnvironment = {
  scripts?: TestScripts;
  env?: EnvironmentVariables;
  addons?: Addon[];
};

/**
 * Defines scripts that are specific to test environments.
 * These scripts are only run in the context of test environments.
 */
export type TestScripts = {
  test?: string;
};

/**
 * Contains environment-specific configurations.
 * Currently supports test environment configuration.
 */
export type Environments = {
  test?: TestEnvironment;
};

/**
 * Represents the available Heroku stack versions.
 * Stacks are the operating system and base container image used to run the application.
 */
export type HerokuStack = 'heroku-18' | 'heroku-20' | 'heroku-22';
