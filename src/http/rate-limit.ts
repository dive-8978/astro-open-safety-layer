import type { RequestHandler } from 'express';

export function rateLimit(limit: number): RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (request, response, next) => {
    const key = request.ip || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      response.setHeader('RateLimit-Limit', String(limit));
      response.setHeader('RateLimit-Remaining', String(limit - 1));
      return next();
    }
    if (bucket.count >= limit) {
      response.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return response.status(429).json({ error: 'rate_limit_exceeded' });
    }
    bucket.count += 1;
    response.setHeader('RateLimit-Limit', String(limit));
    response.setHeader('RateLimit-Remaining', String(limit - bucket.count));
    next();
  };
}
