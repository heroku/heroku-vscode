import type { HerokuSDK } from '@heroku/sdk';
import vscode from 'vscode';

const extension = vscode.extensions.getExtension('Heroku-Dev-Tools.heroku') ?? { packageJSON: {} };
const version = (Reflect.get(extension.packageJSON, 'version') as string) ?? '';

const TELEMETRY_HEADERS = {
  Referer: `vscode-heroku-extension/${version}`,
  'User-Agent': `VSCode-Heroku-Extension/${version} (${process.platform}; ${process.arch}) VSCode/${vscode.version}`
} as const;

/**
 * Creates a HerokuSDK pre-configured for the VS Code extension:
 * VS Code authentication session as the token source, telemetry
 * headers (Referer / User-Agent / X-Account-Id), and an optional
 * AbortSignal pre-applied to both `platform` and `data` namespaces
 * via `withOptions` so callers can write `sdk.platform.app.list()`
 * and still get cancellation on disposal.
 *
 * Pass `token` only when there is no active session yet (e.g. inside
 * the login flow itself); otherwise the helper resolves the token
 * from `vscode.authentication.getSession`.
 *
 * @param signal Optional AbortSignal threaded into every route call.
 * @param token Optional explicit bearer token; falls back to the
 *   active VS Code authentication session when omitted.
 * @returns An SDK exposing `platform` and `data` namespaces.
 * @example
 * ```ts
 * const sdk = await createHerokuSDK(this.signal);
 * const apps = await sdk.platform.app.list();
 * ```
 */
export async function createHerokuSDK(
  signal?: AbortSignal,
  token?: string
): Promise<Pick<HerokuSDK, 'data' | 'platform'>> {
  const session = token ? undefined : await vscode.authentication.getSession('heroku:auth:login', []);

  const headers: Record<string, string> = { ...TELEMETRY_HEADERS };
  if (session?.id) {
    headers['X-Account-Id'] = session.id;
  }

  const resolvedToken = token?.trim() ?? session?.accessToken?.trim() ?? '';

  // `@heroku/sdk` ships ESM only and uses top-level await, which CJS
  // cannot `require`. This extension is compiled to CJS, so reach the
  // SDK via a real dynamic `import()`. The `eval` wrapper keeps TS's
  // NodeNext mode from rewriting the import into a `require` during
  // compilation.
  // eslint-disable-next-line no-eval
  const { HerokuSDK: HerokuSDKCtor } = (await (0, eval)('import("@heroku/sdk")')) as typeof import('@heroku/sdk');
  const sdk = new HerokuSDKCtor({
    clientOptions: {
      headers,
      token: resolvedToken
    }
  });

  if (!signal) return sdk;

  return {
    get data(): HerokuSDK['data'] {
      return sdk.data.withOptions({ signal }) as HerokuSDK['data'];
    },
    get platform(): HerokuSDK['platform'] {
      return sdk.platform.withOptions({ signal }) as HerokuSDK['platform'];
    }
  };
}
