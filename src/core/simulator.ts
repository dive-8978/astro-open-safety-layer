import type { IntentEnvelope, SafetySignal, SimulationResult } from '../types.js';
import { sha256 } from './canonical.js';
import { fingerprintIntent } from './fingerprint.js';
import { inspectIntent } from './risk-engine.js';

interface RpcResponse {
  result?: string;
  error?: { code?: number; message?: string };
}

export class Simulator {
  constructor(private readonly rpcUrls: ReadonlyMap<string, string>) {}

  async simulate(intent: IntentEnvelope, requestLiveRpc: boolean): Promise<SimulationResult> {
    const fingerprint = fingerprintIntent(intent);
    const createdAt = new Date().toISOString();
    const calls: SimulationResult['calls'] = [];
    const signals: SafetySignal[] = inspectIntent(intent);
    let usedRpc = false;
    let complete = true;

    for (const [actionIndex, action] of intent.actions.entries()) {
      const rpcUrl = requestLiveRpc ? this.rpcUrls.get(action.chain) : undefined;
      if (!rpcUrl || !action.to || !action.chain.startsWith('eip155:')) {
        calls.push({ actionIndex, status: 'not-run' });
        complete = false;
        continue;
      }

      usedRpc = true;
      try {
        const tx = {
          ...(action.from ? { from: action.from } : {}),
          to: action.to,
          data: action.data ?? '0x',
          value: action.value ? `0x${BigInt(action.value).toString(16)}` : '0x0',
        };
        const [callResult, gasResult] = await Promise.all([
          this.rpc(rpcUrl, 'eth_call', [tx, 'latest']),
          this.rpc(rpcUrl, 'eth_estimateGas', [tx]),
        ]);
        if (callResult.error) {
          calls.push({ actionIndex, status: 'reverted', error: callResult.error.message ?? 'RPC call reverted' });
          signals.push({ id: 'rpc-revert', severity: 'high', title: 'RPC simulation reverted', evidence: callResult.error.message ?? 'Unknown revert', actionIndex });
        } else {
          calls.push({ actionIndex, status: 'success', returnData: callResult.result, gasEstimate: gasResult.result });
        }
      } catch (error) {
        complete = false;
        calls.push({ actionIndex, status: 'not-run', error: error instanceof Error ? error.message : String(error) });
        signals.push({ id: 'rpc-unavailable', severity: 'medium', title: 'Configured RPC simulation was unavailable', evidence: error instanceof Error ? error.message : String(error), actionIndex });
      }
    }

    if (!usedRpc) {
      signals.push({ id: 'static-only', severity: 'medium', title: 'Only deterministic static checks were performed', evidence: 'Configure an allowlisted RPC and request liveRpc to perform eth_call.' });
    }

    return {
      id: `simulation_${sha256({ fingerprint, createdAt, calls }).slice(7, 31)}`,
      intentFingerprint: fingerprint,
      mode: usedRpc ? 'rpc' : 'static',
      complete: usedRpc && complete && calls.every(call => call.status !== 'not-run'),
      createdAt,
      signals,
      calls,
    };
  }

  private async rpc(url: string, method: string, params: unknown[]): Promise<RpcResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`);
      return await response.json() as RpcResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
