import type { IntentEnvelope, RouteCandidate, SafetyAssessment, SignedSafetyReceipt, SimulationResult } from '../types.js';

export class AstroSafetyClient {
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

  fingerprint(intent: IntentEnvelope) {
    return this.request<{ fingerprint: string; canonical: string; valid: boolean }>('/v1/intents/fingerprint', intent);
  }

  simulate(intent: IntentEnvelope, liveRpc = false) {
    return this.request<SimulationResult>('/v1/simulate', { intent, liveRpc });
  }

  check(intent: IntentEnvelope, liveRpc = false) {
    return this.request<{ assessment: SafetyAssessment; simulation: SimulationResult }>('/v1/check', { intent, liveRpc });
  }

  route(intent: IntentEnvelope, candidates: RouteCandidate[]) {
    return this.request<{ intentFingerprint: string; routes: Array<RouteCandidate & { score: number; selected: boolean }> }>('/v1/route', { intent, candidates });
  }

  issueReceipt(simulationId: string, assessmentId: string) {
    return this.request<SignedSafetyReceipt>('/v1/receipts', { simulationId, assessmentId });
  }

  issueStatelessReceipt(simulation: SimulationResult, assessment: SafetyAssessment) {
    return this.request<SignedSafetyReceipt>('/v1/receipts', { simulation, assessment });
  }

  verifyReceipt(receipt: SignedSafetyReceipt) {
    return this.request<{ valid: boolean; knownKey: boolean; receiptHash: string }>('/v1/receipts/verify', receipt);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Astro Safety API returned ${response.status}`);
    return payload;
  }
}
