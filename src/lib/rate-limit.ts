import "server-only";

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

/**
 * Simple in-memory rate limiter (per key, sliding window).
 * Suitable for single-instance / serverless warm instances; not global across regions.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= maxRequests) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { ok: true };
}
