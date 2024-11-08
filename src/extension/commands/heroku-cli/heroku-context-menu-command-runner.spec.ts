import * as assert from 'node:assert';
import * as vscode from 'vscode';
import Sinon, { type SinonStub } from 'sinon';
import { HerokuContextMenuCommandRunner } from './heroku-context-menu-command-runner';
import { CommandMeta } from '../../manifest';
import { App } from '@heroku-cli/schema';
import { FlagsOrArgs } from './heroku-command-runner';

suite('The HerokuContextMenuCommandRunner', () => {
  let runner: HerokuContextMenuCommandRunner;
  let mockContext: { name: string; app?: { name: string } };

  setup(() => {
    runner = new HerokuContextMenuCommandRunner();
    mockContext = { name: 'test-app', app: { name: 'test-app-name' } };
  });

  teardown(() => {
    Sinon.restore();
  });

  test('hydrateArgs sets app name for required app arg', async () => {
    const userInputByArg = new Map<string, string | undefined>();
    const args = { app: { required: true } };

    await runner['hydrateArgs'](userInputByArg, args as unknown as CommandMeta['args'], mockContext);

    assert.strictEqual(userInputByArg.get('app'), 'test-app-name', 'The app name was not set correctly.');
  });

  test('hydrateArgs does not set app name when app arg is not required', async () => {
    const userInputByArg = new Map<string, string | undefined>();
    const args = { app: { required: false } };

    await runner['hydrateArgs'](userInputByArg, args as unknown as CommandMeta['args'], mockContext);

    assert.strictEqual(userInputByArg.get('app'), undefined, 'The app name should not be set when not required.');
  });

  test('hydrateFlags sets app name for app flag', async () => {
    const userInputByFlag = new Map<string, string | undefined>();
    const flags = { app: {} };

    await runner['hydrateFlags'](userInputByFlag, flags as unknown as CommandMeta['flags'], mockContext);

    assert.strictEqual(userInputByFlag.get('app'), 'test-app-name', 'The app name was not set correctly for flags.');
  });

  test('hydrateFlags does not set app name when app flag is not present', async () => {
    const userInputByFlag = new Map<string, string | undefined>();
    const flags: CommandMeta['flags'] = {};

    await runner['hydrateFlags'](userInputByFlag, flags, mockContext);

    assert.strictEqual(
      userInputByFlag.get('app'),
      undefined,
      'The app name should not be set when flag is not present.'
    );
  });

  test('collectInputsFromManifest removes remote when app is present', () => {
    const flagsOrArgsManifest = {
      app: {},
      remote: {},
      other: {}
    };

    const result = runner['collectInputsFromManifest'](flagsOrArgsManifest as unknown as FlagsOrArgs);

    assert.ok(result.includes('app'), 'The app input should be included.');
    assert.ok(!result.includes('remote'), 'The remote input should be removed when app is present.');
    assert.ok(result.includes('other'), 'Other inputs should remain unchanged.');
  });

  test('getAppNameFromContext returns app name from context', () => {
    const result = runner['getAppNameFromContext'](mockContext);

    assert.strictEqual(result, 'test-app-name', 'The app name was not correctly extracted from the context.');
  });

  test('getAppNameFromContext returns undefined when no app in context', () => {
    const result = runner['getAppNameFromContext']({ name: 'test-app' });

    assert.strictEqual(result, 'test-app', 'The name should be returned when no app property is present.');
  });

  test('isNamedObject correctly identifies named objects', () => {
    assert.strictEqual(
      runner['isNamedObject']({ name: 'test' }),
      true,
      'Object with name property should be identified as named object.'
    );
    assert.strictEqual(runner['isNamedObject']({}), false, 'Empty object should not be identified as named object.');
    assert.strictEqual(runner['isNamedObject'](null), false, 'Null should not be identified as named object.');
    assert.strictEqual(runner['isNamedObject']('string'), false, 'String should not be identified as named object.');
  });
});
