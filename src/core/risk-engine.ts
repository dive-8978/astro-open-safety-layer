import type { IntentEnvelope, SafetyAssessment, SafetySignal, SimulationResult } from '../types.js';
import { fingerprintIntent } from './fingerprint.js';
import { sha256 } from './canonical.js';

const ZERO_ADDRESS = /^0x0{40}$/i;
const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i;
const MAX_UINT256 = /^f{64}$/i;
const SELECTORS = {
  approve: '095ea7b3',
  setApprovalForAll: 'a22cb465',
};

const weights = { info: 0, low: 5, medium: 15, high: 30, critical: 60 } as const;

function numberValue(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function inspectIntent(intent: IntentEnvelope): SafetySignal[] {
  const signals: SafetySignal[] = [];
  const now = Date.now();
  const issuedAt = Date.parse(intent.issuedAt);

  if (Math.abs(now - issuedAt) > 15 * 60_000) {
    signals.push({ id: 'stale-intent', severity: 'medium', title: 'Intent timestamp is outside the freshness window', evidence: intent.issuedAt });
  }

  if (!intent.constraints?.deadline) {
    signals.push({ id: 'missing-deadline', severity: 'low', title: 'Intent has no execution deadline', evidence: 'A delayed or replayed request may remain valid longer than expected.' });
  } else if (Date.parse(intent.constraints.deadline) <= now) {
    signals.push({ id: 'expired-intent', severity: 'critical', title: 'Intent deadline has passed', evidence: intent.constraints.deadline });
  }

  let totalValue = 0;
  intent.actions.forEach((action, actionIndex) => {
    totalValue += numberValue(action.value);
    const isEvm = action.chain.startsWith('eip155:');
    if (isEvm && action.to && !EVM_ADDRESS.test(action.to)) {
      signals.push({ id: 'invalid-evm-recipient', severity: 'critical', title: 'Invalid EVM destination address', evidence: action.to, actionIndex });
    }
    if (action.to && ZERO_ADDRESS.test(action.to)) {
      signals.push({ id: 'zero-address', severity: 'critical', title: 'Destination is the zero address', evidence: action.to, actionIndex });
    }
    if (!action.to && ['call', 'transfer', 'approve'].includes(action.kind)) {
      signals.push({ id: 'missing-destination', severity: 'high', title: 'Action has no destination', evidence: action.kind, actionIndex });
    }

    const calldata = action.data?.slice(2).toLowerCase() ?? '';
    const selector = calldata.slice(0, 8);
    if (selector === SELECTORS.approve) {
      const amountWord = calldata.slice(-64);
      const unlimited = MAX_UINT256.test(amountWord);
      signals.push({
        id: unlimited ? 'unlimited-approval' : 'token-approval',
        severity: unlimited ? 'critical' : 'medium',
        title: unlimited ? 'Unlimited token approval requested' : 'Token approval requested',
        evidence: unlimited ? 'approve(spender, uint256.max)' : 'approve(spender, amount)',
        actionIndex,
      });
    }
    if (selector === SELECTORS.setApprovalForAll) {
      const enabled = calldata.endsWith('1'.padStart(64, '0'));
      if (enabled) signals.push({ id: 'operator-approval', severity: 'high', title: 'Approval for all assets requested', evidence: 'setApprovalForAll(operator, true)', actionIndex });
    }
  });

  const maxTotal = numberValue(intent.constraints?.maxTotalValue);
  if (maxTotal > 0 && totalValue > maxTotal) {
    signals.push({ id: 'value-limit-exceeded', severity: 'critical', title: 'Intent exceeds its maximum total value', evidence: `${totalValue} > ${maxTotal}` });
  }

  const humanThreshold = numberValue(intent.constraints?.requireHumanApprovalAbove);
  if (intent.actor.type === 'agent' && humanThreshold > 0 && totalValue > humanThreshold) {
    signals.push({ id: 'human-approval-required', severity: 'high', title: 'Human approval threshold exceeded', evidence: `${totalValue} > ${humanThreshold}` });
  }

  if (signals.length === 0) {
    signals.push({ id: 'static-checks-clear', severity: 'info', title: 'No static policy violation detected', evidence: 'This does not guarantee successful or safe onchain execution.' });
  }
  return signals;
}

export function assess(intent: IntentEnvelope, simulation: SimulationResult): SafetyAssessment {
  const combined = [...inspectIntent(intent), ...simulation.signals]
    .filter((signal, index, all) => all.findIndex(item => item.id === signal.id && item.actionIndex === signal.actionIndex) === index);
  const score = Math.min(100, combined.reduce((sum, signal) => sum + weights[signal.severity], 0));
  const decision = combined.some(signal => signal.severity === 'critical')
    ? 'block'
    : combined.some(signal => signal.severity === 'high') || !simulation.complete
      ? 'review'
      : 'allow';
  const fingerprint = fingerprintIntent(intent);
  const createdAt = new Date().toISOString();
  return {
    id: `assessment_${sha256({ fingerprint, simulation: simulation.id, score, createdAt }).slice(7, 31)}`,
    intentFingerprint: fingerprint,
    simulationId: simulation.id,
    score,
    decision,
    signals: combined,
    createdAt,
  };
}
