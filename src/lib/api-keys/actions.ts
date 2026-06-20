"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import {
  generateApiKeyRaw,
  hashApiKey,
  keyDisplayPrefix,
} from "@/lib/api-keys/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiKeyRow } from "@/types/api";

export type ActionResult = { ok: boolean; message: string };

export type GeneratedApiKey = {
  id: string;
  fullKey: string;
  prefix: string;
  name: string;
  createdAt: string;
};

const MAX_ACTIVE_KEYS = 10;

async function assertCanManageOrgKeys(orgId: string, userId: string) {
  const db = createAdminClient();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return { ok: false as const, message: "Forbidden." };
  }
  return { ok: true as const };
}

async function countActiveKeys(userId: string, orgId: string | null) {
  const db = createAdminClient();
  let query = db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (orgId) {
    query = query.eq("org_id", orgId);
  } else {
    query = query.is("org_id", null);
  }

  const { count } = await query;
  return count ?? 0;
}

export async function generateApiKey(
  name: string,
  orgId?: string,
): Promise<{ ok: true; key: GeneratedApiKey } | ActionResult> {
  const profile = await requireActiveProfile();
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Key name is required." };
  }
  if (trimmed.length > 100) {
    return { ok: false, message: "Key name must be 100 characters or fewer." };
  }

  const scopeOrgId = orgId?.trim() || null;
  if (scopeOrgId) {
    const gate = await assertCanManageOrgKeys(scopeOrgId, profile.id);
    if (!gate.ok) return gate;
  }

  const active = await countActiveKeys(profile.id, scopeOrgId);
  if (active >= MAX_ACTIVE_KEYS) {
    return {
      ok: false,
      message: `Maximum ${MAX_ACTIVE_KEYS} active keys allowed. Revoke one first.`,
    };
  }

  const fullKey = generateApiKeyRaw();
  const db = createAdminClient();
  const { data, error } = await db
    .from("api_keys")
    .insert({
      user_id: profile.id,
      org_id: scopeOrgId,
      name: trimmed,
      key_hash: hashApiKey(fullKey),
      key_prefix: keyDisplayPrefix(fullKey),
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    console.error("[api-keys] generate failed:", error?.message);
    return { ok: false, message: "Couldn't generate API key." };
  }

  revalidatePath("/app/user-settings");
  revalidatePath("/app/employees");

  return {
    ok: true,
    key: {
      id: data.id,
      fullKey,
      prefix: keyDisplayPrefix(fullKey),
      name: trimmed,
      createdAt: data.created_at,
    },
  };
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: row } = await db
    .from("api_keys")
    .select("id, user_id, org_id, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.user_id !== profile.id) {
    return { ok: false, message: "API key not found." };
  }
  if (row.revoked_at) {
    return { ok: false, message: "Key is already revoked." };
  }

  if (row.org_id) {
    const gate = await assertCanManageOrgKeys(row.org_id, profile.id);
    if (!gate.ok) return gate;
  }

  const { error } = await db
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false, message: "Couldn't revoke API key." };
  }

  revalidatePath("/app/user-settings");
  revalidatePath("/app/employees");
  return { ok: true, message: "API key revoked." };
}

export async function listApiKeysForScope(
  orgId: string | null,
): Promise<ApiKeyRow[]> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  if (orgId) {
    const gate = await assertCanManageOrgKeys(orgId, profile.id);
    if (!gate.ok) return [];
  }

  let query = db
    .from("api_keys")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("org_id", orgId);
  } else {
    query = query.is("org_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api-keys] list failed:", error.message);
    return [];
  }
  return (data ?? []) as ApiKeyRow[];
}
