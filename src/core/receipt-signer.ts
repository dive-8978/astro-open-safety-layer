import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import type { SafetyAssessment, SignedSafetyReceipt, SimulationResult } from '../types.js';
import { canonicalJson, sha256 } from './canonical.js';

export class ReceiptSigner {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  readonly ephemeral: boolean;
  readonly keyId: string;

  constructor(privateKeyBase64?: string) {
    if (privateKeyBase64) {
      const decodedKey = Buffer.from(privateKeyBase64.trim(), 'base64');
      const keyMaterial = decodedKey.toString('utf8').startsWith('-----BEGIN')
        ? decodedKey.toString('utf8')
        : { key: decodedKey, format: 'der' as const, type: 'pkcs8' as const };
      this.privateKey = createPrivateKey(keyMaterial);
      this.publicKey = createPublicKey(this.privateKey);
      this.ephemeral = false;
    } else {
      const pair = generateKeyPairSync('ed25519');
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
      this.ephemeral = true;
    }
    const der = this.publicKey.export({ type: 'spki', format: 'der' });
    this.keyId = `aoi:key:${sha256(der.toString('base64')).slice(7, 23)}`;
  }

  issue(simulation: SimulationResult, assessment: SafetyAssessment): SignedSafetyReceipt {
    const issuedAt = new Date().toISOString();
    const payload = {
      version: 'aoi.receipt/0.1' as const,
      id: `receipt_${sha256({ simulation: simulation.id, assessment: assessment.id, issuedAt }).slice(7, 31)}`,
      intentFingerprint: assessment.intentFingerprint,
      simulationHash: sha256(simulation),
      assessmentHash: sha256(assessment),
      decision: assessment.decision,
      issuedAt,
      issuer: 'Astro Open Safety Layer',
      keyId: this.keyId,
    };
    const signature = sign(null, Buffer.from(canonicalJson(payload)), this.privateKey).toString('base64url');
    return { ...payload, signature, algorithm: 'Ed25519' };
  }

  verify(receipt: SignedSafetyReceipt): boolean {
    const { signature, algorithm: _algorithm, ...payload } = receipt;
    return verify(null, Buffer.from(canonicalJson(payload)), this.publicKey, Buffer.from(signature, 'base64url'));
  }

  publicDescriptor() {
    return {
      keyId: this.keyId,
      algorithm: 'Ed25519',
      publicKeyPem: this.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      ephemeral: this.ephemeral,
    };
  }
}
