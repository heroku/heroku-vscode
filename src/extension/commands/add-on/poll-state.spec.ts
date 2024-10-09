import * as assert from 'node:assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { PollAddOnState } from './poll-state';
import { AddOn } from '@heroku-cli/schema';

suite('The PollAddOnState', () => {
  let getSessionStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;

  const addOn = {
    id: 'addon-123',
    name: 'test-addon',
    state: 'provisioning'
  } as AddOn;

  const sessionObject = {
    account: {
      id: 'Heroku',
      label: 'tester-123@heroku.com'
    },
    id: randomUUID(),
    scopes: [],
    accessToken: randomUUID()
  };

  setup(() => {
    getSessionStub = sinon.stub(vscode.authentication, 'getSession').callsFake(async (providerId: string) => {
      if (providerId === 'heroku:auth:login') {
        return sessionObject;
      }
      return undefined;
    });

    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  teardown(() => {
    getSessionStub.restore();
    fetchStub.restore();
  });

  test('polls until the desired state is reached', async () => {
    fetchStub.onFirstCall().resolves(new Response(JSON.stringify({ state: 'provisioning' })));
    fetchStub.onSecondCall().resolves(new Response(JSON.stringify({ state: 'provisioned' })));

    const pollAddOnState = new PollAddOnState();
    await pollAddOnState.run(addOn, 'provisioned', 10000);

    assert.strictEqual(addOn.state, 'provisioned');
    assert.strictEqual(fetchStub.callCount, 2);
  });

  test('aborts if the timeout is reached', async () => {
    fetchStub.onFirstCall().resolves(new Response(JSON.stringify({ state: 'provisioning' })));
    fetchStub.onSecondCall().resolves(new Response(JSON.stringify({ state: 'provisioning' })));

    const pollAddOnState = new PollAddOnState();
    await pollAddOnState.run(addOn, 'provisioned', 2);

    assert.strictEqual(addOn.state, 'provisioning');
  });

  test('handles signal abort', async () => {
    fetchStub.onFirstCall().resolves(new Response(JSON.stringify({ state: 'provisioning' })));

    const pollAddOnState = new PollAddOnState();
    void pollAddOnState.run(addOn, 'provisioned');
    await new Promise((resolve) => setTimeout(resolve, 2));
    pollAddOnState.abort();

    assert.strictEqual(fetchStub.callCount, 1);
  });
});
