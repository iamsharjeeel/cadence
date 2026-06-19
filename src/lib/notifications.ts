import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "timesheet_submitted"
  | "timesheet_approved"
  | "timesheet_rejected"
  | "time_log_reminder"
  | "timesheet_submit_reminder"
  | "asana_reconnect_required"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
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

/** Notifies every owner/admin member of an org (resolved via memberships). */
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
  // Track C: org admins/owners live in `memberships`, not profiles.org_id
  // (now null for everyone). get_org_admin_ids(p_org_id) returns their user_ids.
  const { data: admins } = await db.rpc("get_org_admin_ids", {
    p_org_id: params.orgId,
  });

  for (const admin of admins ?? []) {
    if (admin.user_id === params.excludeUserId) continue;
    await notifyUser({
      orgId: params.orgId,
      userId: admin.user_id,
      type: params.type,
      title: params.title,
      body: params.body,
      entity: params.entity,
      entityId: params.entityId,
    });
  }
}
