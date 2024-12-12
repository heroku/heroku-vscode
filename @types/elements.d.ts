export type HerokuDeployButton = {
  recent_deploys: number;
  repo_name: string;
  logo: {
    icon_url: string;
    icon_retina_url: string;
  };
  forks: number;
  stars: number;
  subscribers: number;
  created_at: string;
  updated_at: string;
  id: string;
  deploy_url: string;
  public_description: string;
  public_name: string;
  public_username: string;
  public_repository: string;
};

export type HerokuDeployButtonResponse = {
  buttons: HerokuDeployButton[];
};

export type Region = {
  id: number;
  slug: string;
  label: string;
};

export type Category = {
  id: number;
  description: string;
  label: string;
  position: number;
  slug: string;
};

export type Generation = {
  id: string;
  name: string;
};

export type AddonMetadata = {
  languages: string[];
  supports_multiple_installations: boolean;
  supports_sharing: boolean;
  buttons?: any[]; // Only seen in one addon, could be more specific if needed
};

export type Addon = {
  id: string;
  name: string;
  cli_plugin_name: string | null;
  slug: string;
  category: Category;
  icon_url: string;
  regions: Region[];
  summary: string;
  state: string;
  updated_at: string;
  metadata: AddonMetadata;
  provider_terms_url: string | null;
  legal_statements: string | null;
  supported_generations: Generation[];
};

export type CategoryWithAddons = Category & {
  addons: Addon[];
};

export type CategoriesResponse = {
  categories: CategoryWithAddons[];
};
