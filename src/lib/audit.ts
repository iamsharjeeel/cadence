import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db";

export type AuditAction =
  | "profile.approve"
  | "profile.role_change"
  | "profile.rate_change"
  | "profile.status_change"
  | "org.create"
  | "org.update"
  | "org_settings_updated"
  | "timesheet_submitted"
  | "timesheet_approved"
  | "timesheet_rejected"
  | "timesheet_recalled"
  | "timesheet_returned_to_draft"
  | "timesheet_deleted"
  | "timesheet_recalled"
  | "timesheet_returned_to_draft"
  | "document_generated"
  | "document_emailed"
  | "document_status_changed"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "leave_cancelled"
  | "official_document_uploaded"
  | "official_document_signed"
  | "official_document_acknowledged"
  | "official_document_rejected"
  | "onboarding_completed";

/**
 * Writes an entry to `audit_log`. Uses the service-role client so the record is
 * always written regardless of the actor's RLS scope. Audit failures are logged
 * but never throw — they must not break the user-facing mutation that succeeded.
 */
export async function writeAudit(params: {
  actorId: string;
  orgId: string | null;
  action: AuditAction;
  entity?: string | null;
  payload?: Json;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: params.actorId,
    org_id: params.orgId,
    action: params.action,
    entity: params.entity ?? null,
    payload: params.payload ?? null,
  });
  if (error) {
    console.error("[audit] failed to write audit_log entry:", error.message);
  }
}
