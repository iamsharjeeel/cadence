import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { trustOrgScope } from "@/lib/org-scope";
import type { Json } from "@/types/db";

export type AuditLogEntry = {
  id: string;
  created_at: string;
  action: string;
  entity: string | null;
  payload: Json | null;
  org_id: string | null;
  actor: {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  } | null;
};

export async function fetchAuditLog(params: {
  orgId?: string | null;
  actorId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ entries: AuditLogEntry[]; hasMore: boolean }> {
  const scopedOrgId = params.orgId
    ? await trustOrgScope(params.orgId)
    : null;
  const db = createAdminClient();
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 50;
  const from = page * pageSize;
  const to = from + pageSize;

  let query = db
    .from("audit_log")
    .select("id, created_at, action, entity, payload, org_id, actor_id")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (scopedOrgId) query = query.eq("org_id", scopedOrgId);
  if (params.actorId?.trim()) query = query.eq("actor_id", params.actorId.trim());
  if (params.action?.trim()) query = query.eq("action", params.action.trim());
  if (params.entity?.trim()) query = query.eq("entity", params.entity.trim());
  if (params.from?.trim()) {
    query = query.gte("created_at", `${params.from.trim()}T00:00:00Z`);
  }
  if (params.to?.trim()) {
    query = query.lte("created_at", `${params.to.trim()}T23:59:59Z`);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[audit] fetchAuditLog query failed:", error.message);
    return { entries: [], hasMore: false };
  }
  const entries = rows ?? [];
  const hasMore = entries.length > pageSize;
  const slice = hasMore ? entries.slice(0, pageSize) : entries;

  const actorIds = [...new Set(slice.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await db
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", actorIds)
    : { data: [] };

  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));

  return {
    entries: slice.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      action: r.action,
      entity: r.entity,
      payload: r.payload,
      org_id: r.org_id,
      actor: r.actor_id ? actorById.get(r.actor_id) ?? null : null,
    })),
    hasMore,
  };
}

export async function fetchAuditActors(orgId?: string | null) {
  const scopedOrgId = orgId ? await trustOrgScope(orgId) : null;
  const db = createAdminClient();
  if (scopedOrgId) {
    const { data: members } = await db
      .from("memberships")
      .select("user_id")
      .eq("org_id", scopedOrgId);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return [];
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds)
      .order("full_name");
    return data ?? [];
  }
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name");
  return data ?? [];
}

export async function fetchAuditActions(orgId?: string | null) {
  const scopedOrgId = orgId ? await trustOrgScope(orgId) : null;
  const db = createAdminClient();
  let query = db.from("audit_log").select("action").order("action");
  if (scopedOrgId) query = query.eq("org_id", scopedOrgId);
  const { data } = await query;
  const unique = [...new Set((data ?? []).map((r) => r.action))];
  return unique.sort();
}
