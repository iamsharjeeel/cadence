import "server-only";

import crypto from "crypto";

/**
 * Constant-time string comparison for secrets/tokens (cron bearer, OAuth
 * state). A plain `===`/`!==` short-circuits on the first differing byte and
 * is therefore timing-observable; this compares in time independent of where
 * the mismatch is. Returns false on length mismatch (unavoidably observable,
 * but the values here are fixed-length).
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
