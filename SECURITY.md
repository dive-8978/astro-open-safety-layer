# Security Policy

## Report a vulnerability

Do not open a public issue for an unpatched vulnerability. Send a minimal reproduction, affected version and impact assessment to the security contact published by Astro Open Infrastructure. Never include private keys, seed phrases or production credentials.

## Threat model

The reference service assumes request data is hostile. It validates input size and structure, rate limits callers and restricts live RPC access to operator-configured endpoints. It does not hold funds or transaction-signing keys.

The following are outside the v0.1 guarantee:

- correctness or availability of third-party RPC providers;
- undisclosed behavior in destination contracts;
- finality, reorgs or bridge settlement after assessment;
- malicious operator replacement of the receipt-signing key;
- legal or financial suitability of an intended transaction.

Production deployments should place the service behind TLS, persist the Ed25519 signing key in a managed secret store, publish key rotation history and retain append-only receipt logs.
