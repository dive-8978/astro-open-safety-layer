export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type Decision = 'allow' | 'review' | 'block';

export interface IntentActor {
  id: string;
  type: 'human' | 'agent' | 'service';
}

export interface IntentAction {
  kind: 'call' | 'transfer' | 'approve' | 'swap' | 'bridge' | 'custom';
  chain: string;
  from?: string;
  to?: string;
  value?: string;
  data?: string;
  asset?: string;
}

export interface IntentEnvelope {
  version: 'aoi.intent/0.1';
  id?: string;
  actor: IntentActor;
  actions: IntentAction[];
  constraints?: {
    deadline?: string;
    maxTotalValue?: string;
    requireSimulation?: boolean;
    requireHumanApprovalAbove?: string;
  };
  nonce: string;
  issuedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SafetySignal {
  id: string;
  severity: Severity;
  title: string;
  evidence: string;
  actionIndex?: number;
}

export interface SimulationResult {
  id: string;
  intentFingerprint: string;
  mode: 'static' | 'rpc';
  complete: boolean;
  createdAt: string;
  signals: SafetySignal[];
  calls: Array<{
    actionIndex: number;
    status: 'not-run' | 'success' | 'reverted';
    gasEstimate?: string;
    returnData?: string;
    error?: string;
  }>;
}

export interface SafetyAssessment {
  id: string;
  intentFingerprint: string;
  simulationId: string;
  score: number;
  decision: Decision;
  signals: SafetySignal[];
  createdAt: string;
}

export interface SafetyReceiptPayload {
  version: 'aoi.receipt/0.1';
  id: string;
  intentFingerprint: string;
  simulationHash: string;
  assessmentHash: string;
  decision: Decision;
  issuedAt: string;
  issuer: string;
  keyId: string;
}

export interface SignedSafetyReceipt extends SafetyReceiptPayload {
  signature: string;
  algorithm: 'Ed25519';
}

export interface RouteCandidate {
  id: string;
  provider: string;
  feeUsd: number;
  estimatedSeconds: number;
  risk: 'low' | 'medium' | 'high';
  chains: string[];
  metadata?: Record<string, unknown>;
}
