import type { IntentEnvelope } from '../types.js';
import { sha256 } from './canonical.js';

export function fingerprintIntent(intent: IntentEnvelope): string {
  return sha256(intent);
}
