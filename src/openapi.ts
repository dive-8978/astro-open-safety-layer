export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Astro Open Safety Layer API',
    version: '0.1.0',
    description: 'Open, non-custodial intent fingerprinting, simulation, safety assessment, route ranking and verifiable receipts.',
    license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  },
  servers: [{ url: 'http://localhost:8787' }],
  paths: {
    '/health': { get: { summary: 'Liveness and capability status' } },
    '/.well-known/astro-safety': { get: { summary: 'Protocol discovery document' } },
    '/v1/intents/fingerprint': { post: { summary: 'Validate and fingerprint an intent envelope' } },
    '/v1/simulate': { post: { summary: 'Run static checks and optional allowlisted RPC simulation' } },
    '/v1/check': { post: { summary: 'Simulate and return a safety decision' } },
    '/v1/route': { post: { summary: 'Rank user-supplied route candidates deterministically' } },
    '/v1/receipts': { post: { summary: 'Issue a signed safety receipt from a completed assessment' } },
    '/v1/receipts/verify': { post: { summary: 'Verify an Astro safety receipt signature' } },
    '/v1/keys/current': { get: { summary: 'Current public receipt verification key' } },
    '/v1/safety/{chain}/{subject}': { get: { summary: 'Look up an open safety-feed subject' } },
    '/v1/safety/reports': { post: { summary: 'Submit evidence for public review' } },
  },
} as const;
