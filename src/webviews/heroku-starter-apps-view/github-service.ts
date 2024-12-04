import { GithubContentsResponse, GithubSearchResponse, SearchRepositoriesQuery } from 'github-api';
import { AppJson, EnvironmentVariables } from '@heroku/app-json-schema';
/**
 * GithubService
 */
export class GithubService {
  private readonly repositoriesEndpoint = 'https://api.github.com/search/repositories';
  private readonly requestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  } as RequestInit;

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
   *
   * @param contentsUrl
   */
  public async getAppConfigVars(contentsUrl: string): Promise<EnvironmentVariables | undefined> {
    // `https://api.github.com/repos/heroku-reference-apps/heroku-docker-flex-gateway/contents/app.json?ref=main`;

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
