import "server-only";

import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import type { ApiKeyContext } from "@/lib/api-auth";
import { apiJson } from "@/lib/api/v1/response";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export function enforceApiRateLimit(
  ctx: ApiKeyContext,
): NextResponse | null {
  const key = `api:${ctx.keyId}`;
  const result = checkRateLimit(key, MAX_REQUESTS, WINDOW_MS);
  if (result.ok) return null;

  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
  return apiJson(
    { error: "Rate limit exceeded", retry_after: retryAfterSec },
    429,
    { "Retry-After": String(retryAfterSec) },
  );
}

export function requireWritePermission(
  ctx: ApiKeyContext,
): NextResponse | null {
  if (ctx.permission === "read_only") {
    return apiJson({ error: "This API key is read-only" }, 403);
  }
  return null;
}
