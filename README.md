# Astro Open Safety Layer

Astro Open Safety Layer is a free, open and non-custodial reference service for validating blockchain intents before execution and proving the result of that validation afterward.

The service never accepts private keys, never signs asset transactions and never executes a route. It provides a neutral safety boundary that wallets, dapps, AI agents and cross-chain protocols can call before asking a user to authorize an action.

## Implemented in v0.1

- Canonical `aoi.intent/0.1` envelopes and deterministic SHA-256 fingerprints
- Deterministic static checks for destinations, deadlines, value limits and token approvals
- Optional `eth_call` and `eth_estimateGas` through operator-configured RPC allowlists
- Explainable safety scores and `allow`, `review` or `block` decisions
- Vendor-neutral ranking of route candidates supplied by an integrator
- Ed25519-signed `aoi.receipt/0.1` safety receipts and public verification keys
- Open safety-feed lookup and evidence submission with mandatory review status
- OpenAPI discovery, TypeScript SDK, rate limiting, request size limits and Docker deployment

## Quick start

```bash
npm install
cp .env.example .env
npm run check
npm run dev
```

The service starts at `http://localhost:8787`.

```bash
curl http://localhost:8787/health
curl http://localhost:8787/.well-known/astro-safety
```

Run a complete static safety assessment:

```bash
curl -X POST http://localhost:8787/v1/check \
  -H 'content-type: application/json' \
  --data-binary '{"intent":{"version":"aoi.intent/0.1","actor":{"id":"did:example:alice","type":"human"},"actions":[{"kind":"transfer","chain":"eip155:8453","to":"0x2222222222222222222222222222222222222222","value":"1","data":"0x"}],"constraints":{"deadline":"2030-01-01T00:00:00.000Z","maxTotalValue":"2"},"nonce":"demo-1","issuedAt":"2026-07-20T00:00:00.000Z"},"liveRpc":false}'
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness and active capabilities |
| `GET` | `/.well-known/astro-safety` | Machine-readable discovery |
| `POST` | `/v1/intents/fingerprint` | Validate and fingerprint an intent |
| `POST` | `/v1/simulate` | Static analysis and optional RPC simulation |
| `POST` | `/v1/check` | Simulation plus an explainable safety decision |
| `POST` | `/v1/route` | Deterministically rank supplied routes |
| `POST` | `/v1/receipts` | Issue a signed receipt for stored results |
| `POST` | `/v1/receipts/verify` | Verify a receipt signature |
| `GET` | `/v1/keys/current` | Retrieve the current Ed25519 public key |
| `GET` | `/v1/safety/:chain/:subject` | Query the open safety feed |
| `POST` | `/v1/safety/reports` | Submit evidence for public review |

The complete discovery document is available at `/openapi.json`.

Serverless deployments can submit the complete `simulation` and `assessment` objects to `/v1/receipts` instead of relying on process-local result IDs.

## TypeScript SDK

```ts
import { AstroSafetyClient } from '@astro-open/safety-layer/sdk';

const astro = new AstroSafetyClient('https://astro-open-safety-layer.vercel.app');
const result = await astro.check(intent, true);

if (result.assessment.decision === 'block') {
  throw new Error('Astro safety policy blocked this request');
}
```

The free public beta endpoint is live at `https://astro-open-safety-layer.vercel.app`. It uses a persistent Ed25519 signing key and exposes its current public key through `/v1/keys/current`. The reference implementation can also be self-hosted.

## Security boundaries

- A static `allow` decision is not a guarantee that a transaction is safe or will succeed.
- RPC simulation reflects one chain state at one point in time and can become stale.
- Unknown safety-feed subjects are returned as `unknown`, never as safe.
- Community reports stay `pending-review` until a separate verification process confirms them.
- Production operators must configure a persistent signing key. Ephemeral development keys are disclosed in `/health`.
- Only operator-configured RPC URLs are contacted; request bodies cannot supply arbitrary RPC URLs.

See [SECURITY.md](SECURITY.md), [AOI-RFC-0002](docs/rfc/AOI-RFC-0002-intent-envelope.md) and [AOI-RFC-0003](docs/rfc/AOI-RFC-0003-safety-receipt.md).

## Relationship to AstroBridge

AstroBridge remains an execution and coordination system. Astro Open Safety Layer is intentionally separate: it is a neutral pre-execution and proof service that any wallet, bridge, dapp or agent can use without adopting the rest of the Astro product stack.

## License

Apache-2.0. The hosted public service is intended to remain free at the protocol and standard API tier.
