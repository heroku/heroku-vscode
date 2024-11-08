import * as assert from 'node:assert';
import * as vscode from 'vscode';
import Sinon, { type SinonMock, type SinonStub } from 'sinon';
import LogSessionService from '@heroku-cli/schema/services/log-session-service.js';
import type { AddOnAttachment, App, LogSession, Plan, Price } from '@heroku-cli/schema';
import { HerokuAddOnCommandRunner } from './heroku-addon-command-runner';
import PlanService from '@heroku-cli/schema/services/plan-service.js';
import AddOnAttachmentService from '@heroku-cli/schema/services/add-on-attachment-service.js';
import { Command } from '@oclif/config';

suite('The HerokuAddOnCommandRunner', () => {
  let logServiceStub: SinonStub;
  let authStub: SinonStub;
  let planServiceStub: SinonStub;
  let attachmentServiceStub: SinonStub;
  let runner: HerokuAddOnCommandRunner;
  let mockAddOn: any;

  setup(() => {
    runner = new HerokuAddOnCommandRunner();
    mockAddOn = {
      name: 'test-addon',
      addon_service: { name: 'test-service', id: 'test-service-id' },
      plan: { id: 'test-plan-id' },
      id: 'test-addon-id'
    };

    logServiceStub = Sinon.stub(LogSessionService.prototype, 'create').resolves({
      logplex_url: 'https://example.com'
    } as LogSession);

    authStub = Sinon.stub(vscode.authentication, 'getSession').resolves({
      accessToken: 'token'
    } as vscode.AuthenticationSession);

    planServiceStub = Sinon.stub(PlanService.prototype, 'listByAddOn').resolves([
      {
        human_name: 'Basic Plan',
        name: 'basic',
        id: 'basic-id',
        price: { cents: 1000 } as Price,
        description: 'Basic plan'
      } as Plan,
      {
        human_name: 'Pro Plan',
        name: 'pro',
        id: 'pro-id',
        price: { cents: 5000 } as Price,
        description: 'Pro plan'
      } as Plan
    ]);

    attachmentServiceStub = Sinon.stub(AddOnAttachmentService.prototype, 'listByAddOn').resolves([
      { name: 'Attachment 1', id: 'attachment-1' } as AddOnAttachment,
      { name: 'Attachment 2', id: 'attachment-2' } as AddOnAttachment
    ]);
  });

  teardown(() => {
    Sinon.restore();
  });

  test('hydrateArgs sets addon name for required addon arg', async () => {
    const userInputByArg = new Map<string, string | undefined>();
    const args = { addon: { required: true } } as unknown as Record<string, Command.Arg>;

    await runner['hydrateArgs'](userInputByArg, args, mockAddOn);

    assert.strictEqual(userInputByArg.get('addon'), 'test-addon', 'The addon name was not set correctly.');
  });

  test('hydrateFlags sets addon name for required addon flag', async () => {
    const userInputByFlag = new Map<string, string | undefined>();
    const flags = { addon: { required: true } } as unknown as Record<string, Command.Flag>;

    await runner['hydrateFlags'](userInputByFlag, flags, mockAddOn);

    assert.strictEqual(userInputByFlag.get('addon'), 'test-addon', 'The addon name was not set correctly for flags.');
  });

  test('injectPlanOptionsIntoCommand adds plan options for addons:upgrade command', async () => {
    const upgradePlanArgs = {} as Command.Arg;

    await runner['injectPlanOptionsIntoCommand'](upgradePlanArgs, mockAddOn);

    assert.ok(upgradePlanArgs.hasOwnProperty('options'), 'Plan options were not added to the command.');
    assert.strictEqual(upgradePlanArgs.required, true, 'The required property was not set correctly.');

    const options = upgradePlanArgs.options as unknown as Promise<(vscode.QuickPickItem & { value: string })[]>;

    const result = await options;
    assert.strictEqual(result?.length, 4, 'Incorrect number of plan options returned.');
    assert.ok(result[1].label.includes('Basic Plan'), 'Basic Plan option is missing or incorrect.');
    assert.strictEqual(result[1].value, 'basic', 'Basic Plan value is incorrect.');

    assert.ok(planServiceStub.calledOnce, 'The plan service was not called.');
    assert.ok(authStub.calledOnce, 'The authentication service was not called.');
  });

  test('injectAttachmentOptionsIntoCommand adds attachment options for addons:detach command', async () => {
    const detachAttachmentArg = {} as Command.Arg;

    await runner['injectAttachmentOptionsIntoCommand'](detachAttachmentArg, mockAddOn);

    assert.ok(detachAttachmentArg.hasOwnProperty('options'), 'Attachment options were not added to the command.');
    assert.strictEqual(detachAttachmentArg.required, true, 'The required property was not set correctly.');

    const options = detachAttachmentArg.options as unknown as Promise<(vscode.QuickPickItem & { value: string })[]>;

    const result = await options;
    assert.strictEqual(result.length, 3, 'Incorrect number of attachment options returned.');
    assert.strictEqual(result[1].label, 'Attachment 1', 'First attachment option is missing or incorrect.');
    assert.strictEqual(result[1].value, 'attachment-1', 'First attachment value is incorrect.');

    assert.ok(attachmentServiceStub.calledOnce, 'The attachment service was not called.');
    assert.ok(authStub.calledOnce, 'The authentication service was not called.');
  });
});
