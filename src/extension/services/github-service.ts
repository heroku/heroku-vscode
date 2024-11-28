import { GithubSearchResponse, SearchRepositoriesQuery } from 'github-api';
import { getGithubSession } from '../utils/git-utils';
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

    const session = await getGithubSession();
    if (session) {
      Reflect.set(requestInit.headers!, 'Authorization', `Bearer ${session.accessToken}`);
    } else {
      logExtensionEvent('No GitHub session found. Query limits will be enforced by github.');
    }

    let response: Response;
    try {
      let queryText = query.q.join('+');
      queryText += query.sort ? `&sort=${query.sort}` : '';
      queryText += query.order ? `&order=${query.order}` : '';

      response = await fetch(`https://api.github.com/search/repositories?q=${queryText}`, requestInit);
      if (response.ok) {
        return (await response.json()) as GithubSearchResponse;
      }
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }

    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }
}
