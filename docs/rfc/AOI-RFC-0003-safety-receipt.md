# AOI-RFC-0003: Safety Receipt

- Status: Draft
- Version: 0.1
- License: Apache-2.0

## Abstract

A Safety Receipt is a compact signed statement linking an intent fingerprint to a simulation result and an explainable safety assessment. It lets a wallet, auditor or explorer verify what was checked without trusting transport logs.

## Payload

| Field | Meaning |
|---|---|
| `version` | Must be `aoi.receipt/0.1` |
| `id` | Unique receipt identifier |
| `intentFingerprint` | AOI-RFC-0002 fingerprint |
| `simulationHash` | SHA-256 hash of the complete simulation result |
| `assessmentHash` | SHA-256 hash of the complete safety assessment |
| `decision` | `allow`, `review` or `block` |
| `issuedAt` | Receipt issuance time |
| `issuer` | Human-readable issuing service |
| `keyId` | Identifier of the public verification key |

The canonical payload is signed using Ed25519. `signature` and `algorithm` are added after signing and are not part of the signed bytes.

## Verification

Verifiers must obtain the public key from a trusted deployment record, confirm that `keyId` matches, verify the Ed25519 signature and independently recompute simulation and assessment hashes when those documents are available.

## Non-goals

A valid receipt proves what one service reported. It does not prove that a transaction was later submitted, finalized or economically suitable. A separate execution receipt may reference this receipt in a future RFC.
