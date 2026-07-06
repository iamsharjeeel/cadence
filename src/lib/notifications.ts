import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "timesheet_submitted"
  | "timesheet_approved"
  | "timesheet_rejected"
  | "time_log_reminder"
  | "time_entry_pending"
  | "time_entry_approved"
  | "time_entry_rejected"
  | "asana_reconnect_required"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "official_document_assigned"
  | "official_document_signed"
  | "org_document_ack_reminder";

export async function notifyUser(params: {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entity?: string;
  entityId?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("notifications").insert({
    org_id: params.orgId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
  });
  if (error) {
    console.error("[notifications] insert failed:", error.message);
  }
}

/** Notifies every active owner and manager in an org (excludes superadmins unless they belong to the org). */
export async function notifyOrgAdmins(params: {
  orgId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entity?: string;
  entityId?: string;
  excludeUserId?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { data: memberships } = await db
    .from("memberships")
    .select("user_id")
    .eq("org_id", params.orgId)
    .in("role", ["owner", "admin"]);

  const memberIds = (memberships ?? []).map((m) => m.user_id as string);
  if (!memberIds.length) return;

  const { data: admins } = await db
    .from("profiles")
    .select("id")
    .in("id", memberIds)
    .eq("status", "active");

  for (const admin of admins ?? []) {
    if (admin.id === params.excludeUserId) continue;
    await notifyUser({
      orgId: params.orgId,
      userId: admin.id,
      type: params.type,
      title: params.title,
      body: params.body,
      entity: params.entity,
      entityId: params.entityId,
    });
  }
}
