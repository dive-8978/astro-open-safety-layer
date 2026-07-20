# AOI-RFC-0002: Intent Envelope

- Status: Draft
- Version: 0.1
- License: Apache-2.0

## Abstract

The Astro Open Intent Envelope is a chain-neutral JSON document that states who is requesting an outcome, which actions are proposed and which limits must remain true. It is designed for deterministic fingerprinting before wallet authorization.

## Required fields

| Field | Meaning |
|---|---|
| `version` | Must be `aoi.intent/0.1` |
| `actor` | Human, agent or service identifier |
| `actions` | Ordered list of proposed operations |
| `nonce` | Caller-scoped replay protection value |
| `issuedAt` | RFC 3339 issuance time |

Each action contains a CAIP-style chain reference where possible, an operation kind and optional sender, destination, value, calldata and asset identifier.

## Constraints

The optional constraint object can set an execution deadline, maximum aggregate value, mandatory simulation and a threshold above which an AI agent must return control to a human.

## Fingerprinting

1. Remove object properties whose value is `undefined`.
2. Sort every object by Unicode code-point key order.
3. Preserve array order.
4. Serialize as compact JSON.
5. Compute SHA-256 and prefix the lowercase hexadecimal digest with `sha256:`.

Metadata is included in the fingerprint. Integrators should exclude private or unstable metadata before constructing the envelope.

## Security considerations

An envelope is not an authorization signature. Wallets must bind the fingerprint, actor, chain, nonce and deadline to their own authorization mechanism. Implementations must reject expired requests and must not silently widen constraints.
