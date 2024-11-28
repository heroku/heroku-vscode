import { GithubSearchResponse, SearchRepositoriesQuery } from 'github-api';
import { logExtensionEvent } from '../utils/logger';

/**
 * GithubService
 */
export class GithubService {
  /**
   * Searches for repositories matching the query.
   *
   * @param query a GraphQL formatted query string
   * @returns a list of repositories matching the query
   */
  public async searchRepositories(query: SearchRepositoriesQuery): Promise<GithubSearchResponse> {
    const requestInit = {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    } as RequestInit;

    const params = new URLSearchParams(query);
    let response: Response;
    try {
      logExtensionEvent(`Searching for repositories with query: ${params.toString()}`);
      response = await fetch(`https://api.github.com/search/repositories?${params.toString()}`, requestInit);
      if (response.ok) {
        return (await response.json()) as GithubSearchResponse;
      }
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }

    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }
}
