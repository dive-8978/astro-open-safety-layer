import assert from 'node:assert/strict';
import test from 'node:test';
import { ReceiptSigner } from '../src/core/receipt-signer.js';
import { fingerprintIntent } from '../src/core/fingerprint.js';
import { inspectIntent } from '../src/core/risk-engine.js';
import { rankRoutes } from '../src/core/route-planner.js';
import type { IntentEnvelope, SafetyAssessment, SimulationResult } from '../src/types.js';

const baseIntent: IntentEnvelope = {
  version: 'aoi.intent/0.1',
  actor: { id: 'did:example:alice', type: 'human' },
  actions: [{
    kind: 'transfer',
    chain: 'eip155:1',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '1',
    data: '0x',
  }],
  constraints: { deadline: '2030-01-01T00:00:00.000Z', maxTotalValue: '2' },
  nonce: 'n-1',
  issuedAt: new Date().toISOString(),
};

test('intent fingerprint is independent of object key order', () => {
  const reordered = {
    nonce: baseIntent.nonce,
    actions: baseIntent.actions,
    actor: baseIntent.actor,
    version: baseIntent.version,
    issuedAt: baseIntent.issuedAt,
    constraints: baseIntent.constraints,
  } as IntentEnvelope;
  assert.equal(fingerprintIntent(baseIntent), fingerprintIntent(reordered));
});

test('unlimited ERC-20 approval is critical', () => {
  const approval: IntentEnvelope = {
    ...baseIntent,
    actions: [{
      kind: 'approve',
      chain: 'eip155:1',
      to: '0x2222222222222222222222222222222222222222',
      data: `0x095ea7b3${'0'.repeat(24)}${'3'.repeat(40)}${'f'.repeat(64)}`,
    }],
  };
  assert.ok(inspectIntent(approval).some(signal => signal.id === 'unlimited-approval' && signal.severity === 'critical'));
});

test('route planner favors safer balanced route', () => {
  const routes = rankRoutes([
    { id: 'cheap-risky', provider: 'A', feeUsd: 0.1, estimatedSeconds: 20, risk: 'high', chains: ['eip155:1'] },
    { id: 'safe', provider: 'B', feeUsd: 0.2, estimatedSeconds: 30, risk: 'low', chains: ['eip155:1'] },
  ], { fee: 0.2, speed: 0.2, safety: 0.6 });
  assert.equal(routes[0]?.id, 'safe');
  assert.equal(routes[0]?.selected, true);
});

test('signed receipt verifies and fails after mutation', () => {
  const signer = new ReceiptSigner();
  const simulation: SimulationResult = {
    id: 'simulation-1', intentFingerprint: fingerprintIntent(baseIntent), mode: 'static', complete: false,
    createdAt: new Date().toISOString(), signals: [], calls: [{ actionIndex: 0, status: 'not-run' }],
  };
  const assessment: SafetyAssessment = {
    id: 'assessment-1', intentFingerprint: simulation.intentFingerprint, simulationId: simulation.id,
    score: 15, decision: 'review', signals: [], createdAt: new Date().toISOString(),
  };
  const receipt = signer.issue(simulation, assessment);
  assert.equal(signer.verify(receipt), true);
  assert.equal(signer.verify({ ...receipt, decision: 'allow' }), false);
});
