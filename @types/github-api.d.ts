export type GithubSearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: RepoSearchResultItem[];
};

/**
 *
 * Repo Search Result Item
 */
export type RepoSearchResultItem = {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: null | SimpleUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  master_branch?: string;
  default_branch: string;
  score: number;
  forks_url: string;
  keys_url: string;
  collaborators_url: string;
  teams_url: string;
  hooks_url: string;
  issue_events_url: string;
  events_url: string;
  assignees_url: string;
  branches_url: string;
  tags_url: string;
  blobs_url: string;
  git_tags_url: string;
  git_refs_url: string;
  trees_url: string;
  statuses_url: string;
  languages_url: string;
  stargazers_url: string;
  contributors_url: string;
  subscribers_url: string;
  subscription_url: string;
  commits_url: string;
  git_commits_url: string;
  comments_url: string;
  issue_comment_url: string;
  contents_url: string;
  compare_url: string;
  merges_url: string;
  archive_url: string;
  downloads_url: string;
  issues_url: string;
  pulls_url: string;
  milestones_url: string;
  notifications_url: string;
  labels_url: string;
  releases_url: string;
  deployments_url: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  forks: number;
  open_issues: number;
  watchers: number;
  topics?: string[];
  mirror_url: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_pages: boolean;
  has_wiki: boolean;
  has_downloads: boolean;
  has_discussions?: boolean;
  archived: boolean;
  /**
   * Returns whether or not this repository disabled.
   */
  disabled: boolean;
  /**
   * The repository visibility: public, private, or internal.
   */
  visibility?: string;
  license: null | LicenseSimple;
  permissions?: Permissions;
  text_matches?: Array<{
    object_url?: string;
    object_type?: string | null;
    property?: string;
    fragment?: string;
    matches?: Array<{
      text?: string;
      indices?: number[];
    }>;
  }>;
  temp_clone_token?: string;
  allow_merge_commit?: boolean;
  allow_squash_merge?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_forking?: boolean;
  is_template?: boolean;
  web_commit_signoff_required?: boolean;
};

/**
 *
 * A GitHub user.
 */
export type SimpleUser = {
  name?: string | null;
  email?: string | null;
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  starred_at?: string;
  user_view_type?: string;
};

/**
 *
 * License Simple
 */
export type LicenseSimple = {
  key: string;
  name: string;
  url: string | null;
  spdx_id: string | null;
  node_id: string;
  html_url?: string;
};

export type Permissions = {
  admin: boolean;
  maintain?: boolean;
  push: boolean;
  triage?: boolean;
  pull: boolean;
};

export type SearchRepositoriesQuery = {
  q: string;
  sort?: string;
  order?: 'stars' | 'forks' | 'help-wanted-issues' | ' updates';
  per_page?: string;
  page?: string;
};
