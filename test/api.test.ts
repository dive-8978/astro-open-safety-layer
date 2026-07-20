import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import type { IntentEnvelope } from '../src/types.js';

const config: AppConfig = {
  port: 0,
  corsOrigins: '*',
  rateLimitPerMinute: 1000,
  maxRequestBytes: 262_144,
  rpcUrls: new Map(),
};

const intent: IntentEnvelope = {
  version: 'aoi.intent/0.1',
  actor: { id: 'did:example:test', type: 'human' },
  actions: [{ kind: 'transfer', chain: 'eip155:1', to: '0x2222222222222222222222222222222222222222', value: '1', data: '0x' }],
  constraints: { deadline: '2030-01-01T00:00:00.000Z', maxTotalValue: '2' },
  nonce: 'api-test',
  issuedAt: new Date().toISOString(),
};

test('HTTP check and receipt lifecycle', async () => {
  const server = createServer(createApp(config));
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const checkResponse = await fetch(`${base}/v1/check`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent, liveRpc: false }),
    });
    assert.equal(checkResponse.status, 200);
    const check = await checkResponse.json() as any;
    assert.equal(check.assessment.decision, 'review');

    const receiptResponse = await fetch(`${base}/v1/receipts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: check.simulation.id, assessmentId: check.assessment.id }),
    });
    assert.equal(receiptResponse.status, 201);
    const receipt = await receiptResponse.json();

    const verifyResponse = await fetch(`${base}/v1/receipts/verify`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(receipt),
    });
    assert.equal(verifyResponse.status, 200);
    assert.equal((await verifyResponse.json() as any).valid, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
