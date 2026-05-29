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
 * The signal is bound at construction and shared by every call made
 * through the returned SDK. That matches our usage — callers want the
 * lifecycle signal of the unit of work (typically `HerokuCommand`) to
 * abort every in-flight request when the command is disposed. Do not
 * stash the returned SDK on a longer-lived owner: once the captured
 * signal aborts, every subsequent call through that SDK rejects.
 *
 * If a single call needs a different signal, override per-call via
 * `withOptions` (last-one-wins): `sdk.platform.withOptions({signal:
 * other}).app.info(...)`.
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

/**
 * Returns a `platform` client wrapped to request a larger
 * `app.list` page than the API default of 200, so accounts with many
 * apps don't see silent truncation.
 *
 * Temporary helper until the SDK ships native list-pagination
 * (W-22717723). Callers use it like:
 *
 * ```ts
 * const apps = await appsClient(sdk).app.list();
 * ```
 *
 * The 1000 ceiling matches what the Platform tolerates in a single
 * `Range` request and is enough for everyone we know about today.
 *
 * @param sdk An SDK (typically from `createHerokuSDK`) whose
 *   `platform` namespace will be wrapped.
 * @returns A platform client whose every call carries the bumped
 *   `Range` header.
 */
export function appsClient(sdk: Pick<HerokuSDK, 'platform'>): HerokuSDK['platform'] {
  return sdk.platform.withOptions({ headers: { Range: 'name ..; max=1000;' } }) as HerokuSDK['platform'];
}
