import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api-keys/crypto";

export type ApiKeyContext = {
  userId: string;
  orgId: string | null;
  keyId: string;
};

/**
 * Validates a Bearer API key from the Authorization header.
 * Returns null when missing, invalid, or revoked.
 */
export async function validateApiKey(
  request: Request,
): Promise<ApiKeyContext | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const rawKey = header.slice("Bearer ".length).trim();
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const db = createAdminClient();

  const { data: row } = await db
    .from("api_keys")
    .select("id, user_id, org_id, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!row) return null;

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null;
  }

  void db
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    userId: row.user_id,
    orgId: row.org_id,
    keyId: row.id,
  };
}
