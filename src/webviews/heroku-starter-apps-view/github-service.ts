import {
  GithubContentsResponse,
  GithubSearchResponse,
  RepoSearchResultItem,
  SearchRepositoriesQuery
} from 'github-api';
import { AppJson, EnvironmentVariables } from '@heroku/app-json-schema';
/**
 * GithubService
 */
export class GithubService {
  private readonly repositoriesEndpoint = 'https://api.github.com/search/repositories';
  private readonly headers = new Headers({
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  });
  private readonly requestInit = {
    method: 'GET',
    headers: this.headers
  } as RequestInit;

  #accessToken: string | undefined;
  /**
   * gets the access token
   */
  public get accessToken(): string | undefined {
    return this.#accessToken;
  }

  /**
   * Sets the access token
   */
  public set accessToken(value: string | undefined) {
    if (this.#accessToken === value) {
      return;
    }
    this.#accessToken = value;

    if (!value) {
      this.headers.delete('Authorization');
      return;
    }
    this.headers.append('Authorization', `Bearer ${value}`);
  }

  /**
   * Searches for repositories matching the query.
   *
   * @param query a GraphQL formatted query string
   * @returns a list of repositories matching the query
   */
  public async searchRepositories(query: SearchRepositoriesQuery): Promise<GithubSearchResponse> {
    const params = new URLSearchParams(query);
    let response: Response;
    try {
      response = await fetch(`${this.repositoriesEndpoint}?${params.toString()}`, this.requestInit);
      if (response.ok) {
        return (await response.json()) as GithubSearchResponse;
      }
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }

    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }

  /**
   * Gets repo data by the specified owner and repo name.
   *
   * @returns a promise that resolves to a RepoSearchResultItem
   */
  public async getRepo(owner: string, repoName: string): Promise<RepoSearchResultItem> {
    const repo = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, this.requestInit);
    if (!repo.ok) {
      throw new Error(`Search failed: ${repo.status} ${repo.statusText}`);
    }
    return (await repo.json()) as RepoSearchResultItem;
  }

  /**
   * Gets the config vars from the app.json file in the repository.
   *
   * @param contentsUrl The api for retrieving github contents
   */
  public async getAppConfigVars(contentsUrl: string): Promise<EnvironmentVariables | undefined> {
    // e.g. https://api.github.com/repos/heroku-reference-apps/heroku-docker-flex-gateway/contents/app.json?ref=main;

    const repoContentsEndpoint = `${contentsUrl.replace('{+path}', 'app.json')}`;
    let result: Response;
    try {
      result = await fetch(repoContentsEndpoint, this.requestInit);
      if (result.ok) {
        const responseJson = (await result.json()) as GithubContentsResponse;
        const appJson = JSON.parse(atob(responseJson.content)) as AppJson;
        return appJson.env;
      }
    } catch (error) {
      // no-op
    }
    return undefined;
  }
}
