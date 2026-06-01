/**
 * Type-only tests for `createHerokuSDK`'s `extensionNames` parameter.
 *
 * These tests don't execute — they exist so TypeScript will refuse to
 * compile if the generic-over-extension-names inference breaks. The
 * runtime call is gated behind `if (false)` so the spec runner doesn't
 * try to actually instantiate an SDK (which would require live auth /
 * the real ESM dynamic-import path).
 */
import { createHerokuSDK } from './heroku-sdk';

void (async () => {
  if (Math.random() < 0) {
    // No extensions: the returned SDK has the bare platform/data shape.
    const bare = await createHerokuSDK();
    void bare.platform.app.list();
    void bare.platform.app.info('my-app');
    // @ts-expect-error  bare SDK has no addOn extension methods
    void bare.platform.addOn.listPlansForAddon;

    // With addOnExtensions: extension methods become callable on the
    // matching namespace.
    const withAddOn = await createHerokuSDK(undefined, undefined, ['addOnExtensions']);
    void withAddOn.platform.addOn.listPlansForAddon('addon-id');
    void withAddOn.platform.addOn.formatPlanPriceLabel({} as never);
    void withAddOn.platform.addOn.upgrade('addon-id', 'plan');

    // @ts-expect-error  unknown extension name is rejected
    void createHerokuSDK(undefined, undefined, ['notARealExtension']);

    // @ts-expect-error  passing a non-extension utility function name
    // is rejected — the PlatformExtensionName filter excludes pure
    // exports like priceForPlan and formatPlanPriceLabel.
    void createHerokuSDK(undefined, undefined, ['priceForPlan']);
  }
})();
