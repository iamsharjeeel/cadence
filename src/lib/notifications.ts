import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "timesheet_submitted"
  | "timesheet_approved"
  | "timesheet_rejected"
  | "time_log_reminder"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "official_document_assigned"
  | "official_document_signed";

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

/** Notifies every active Manager (admin) and Owner in an org. */
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
  const { data: managers } = await db
    .from("profiles")
    .select("id")
    .eq("org_id", params.orgId)
    .in("role", ["admin", "owner"])
    .eq("status", "active");

  for (const manager of managers ?? []) {
    if (manager.id === params.excludeUserId) continue;
    await notifyUser({
      orgId: params.orgId,
      userId: manager.id,
      type: params.type,
      title: params.title,
      body: params.body,
      entity: params.entity,
      entityId: params.entityId,
    });
  }
}
