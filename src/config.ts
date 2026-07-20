export interface AppConfig {
  port: number;
  corsOrigins: string[] | '*';
  rateLimitPerMinute: number;
  maxRequestBytes: number;
  signingPrivateKeyBase64?: string;
  rpcUrls: Map<string, string>;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const origins = (env.CORS_ALLOWED_ORIGINS ?? '*').split(',').map(item => item.trim()).filter(Boolean);
  const rpcUrls = new Map<string, string>();
  if (env.RPC_1_URL) rpcUrls.set('eip155:1', env.RPC_1_URL);
  if (env.RPC_56_URL) rpcUrls.set('eip155:56', env.RPC_56_URL);
  if (env.RPC_8453_URL) rpcUrls.set('eip155:8453', env.RPC_8453_URL);
  return {
    port: positiveInteger(env.PORT, 8787),
    corsOrigins: origins.includes('*') ? '*' : origins,
    rateLimitPerMinute: positiveInteger(env.RATE_LIMIT_PER_MINUTE, 120),
    maxRequestBytes: positiveInteger(env.MAX_REQUEST_BYTES, 262_144),
    signingPrivateKeyBase64: env.AOI_SIGNING_PRIVATE_KEY_BASE64 || undefined,
    rpcUrls,
  };
}
