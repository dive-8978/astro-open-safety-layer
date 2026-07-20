import type { RouteCandidate } from '../types.js';

export interface RouteWeights {
  fee: number;
  speed: number;
  safety: number;
}

const riskScore = { low: 1, medium: 0.5, high: 0 } as const;

export function rankRoutes(candidates: RouteCandidate[], weights: RouteWeights) {
  const maxFee = Math.max(...candidates.map(item => item.feeUsd), 1);
  const maxTime = Math.max(...candidates.map(item => item.estimatedSeconds), 1);
  const totalWeight = weights.fee + weights.speed + weights.safety || 1;
  return candidates
    .map(candidate => {
      const fee = 1 - candidate.feeUsd / maxFee;
      const speed = 1 - candidate.estimatedSeconds / maxTime;
      const safety = riskScore[candidate.risk];
      const score = ((fee * weights.fee) + (speed * weights.speed) + (safety * weights.safety)) / totalWeight;
      return { ...candidate, score: Math.round(score * 10_000) / 100, selected: false };
    })
    .sort((left, right) => right.score - left.score)
    .map((candidate, index) => ({ ...candidate, selected: index === 0 }));
}
