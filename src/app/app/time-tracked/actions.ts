"use server";

import { revalidatePath } from "next/cache";

import { canApproveInOrg } from "@/lib/approvals";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";

export type ActionResult = { ok: boolean; message: string };

async function requireTimeEntryApprover() {
  const ctx = await getWorkspaceContext();
  if (!ctx?.activeOrgId) {
    return { ok: false as const, message: "Switch to an organization workspace." };
  }
  const orgId = ctx.activeOrgId;
  const allowed = await canApproveInOrg(orgId, ctx.workspaceRole);
  if (!allowed) {
    return { ok: false as const, message: "Forbidden." };
  }
  return {
    ok: true as const,
    ctx,
    orgId,
    actor: ctx.effectiveProfile,
  };
}

async function loadPendingEntry(id: string, orgId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("time_entries")
    .select("id, org_id, employee_id, status, entry_date, description")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.org_id !== orgId) return null;
  if (data.status !== "pending_approval") return null;
  return data;
}

export async function approveTimeEntry(id: string): Promise<ActionResult> {
  const gate = await requireTimeEntryApprover();
  if (!gate.ok) return gate;

  const entry = await loadPendingEntry(id, gate.orgId);
  if (!entry) {
    return { ok: false, message: "Entry not found or not pending." };
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("time_entries")
    .update({ status: "approved", updated_at: now })
    .eq("id", id);

  if (error) {
    console.error("[time-entry] approve failed:", error.message);
    return { ok: false, message: "Couldn't approve entry." };
  }

  await notifyUser({
    orgId: gate.orgId,
    userId: entry.employee_id,
    type: "time_entry_approved",
    title: "Your logged time was approved",
    body: entry.entry_date,
    entity: "time_entries",
    entityId: id,
  });

  await writeAudit({
    actorId: gate.actor.id,
    orgId: gate.orgId,
    action: "time_entry_approved",
    entity: "time_entries",
    payload: { entry_id: id, employee_id: entry.employee_id },
  });

  revalidatePath("/app/time-tracked");
  revalidatePath("/app/reports");
  return { ok: true, message: "Time entry approved." };
}

export async function rejectTimeEntry(
  id: string,
  note: string,
): Promise<ActionResult> {
  const gate = await requireTimeEntryApprover();
  if (!gate.ok) return gate;

  const trimmed = note.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection note is required." };
  }

  const entry = await loadPendingEntry(id, gate.orgId);
  if (!entry) {
    return { ok: false, message: "Entry not found or not pending." };
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("time_entries")
    .update({ status: "rejected", updated_at: now })
    .eq("id", id);

  if (error) {
    console.error("[time-entry] reject failed:", error.message);
    return { ok: false, message: "Couldn't reject entry." };
  }

  await notifyUser({
    orgId: gate.orgId,
    userId: entry.employee_id,
    type: "time_entry_rejected",
    title: "Your logged time was rejected",
    body: trimmed,
    entity: "time_entries",
    entityId: id,
  });

  await writeAudit({
    actorId: gate.actor.id,
    orgId: gate.orgId,
    action: "time_entry_rejected",
    entity: "time_entries",
    payload: {
      entry_id: id,
      employee_id: entry.employee_id,
      note: trimmed,
    },
  });

  revalidatePath("/app/time-tracked");
  return { ok: true, message: "Time entry rejected." };
}

export async function approveTimeEntries(ids: string[]): Promise<ActionResult> {
  const gate = await requireTimeEntryApprover();
  if (!gate.ok) return gate;

  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) {
    return { ok: false, message: "No entries selected." };
  }

  let approved = 0;
  for (const id of unique) {
    const result = await approveTimeEntry(id);
    if (result.ok) approved += 1;
  }

  if (approved === 0) {
    return { ok: false, message: "No entries were approved." };
  }

  return {
    ok: true,
    message:
      approved === 1
        ? "1 time entry approved."
        : `${approved} time entries approved.`,
  };
}

export async function notifyPendingTimeEntry(params: {
  orgId: string;
  entryId: string;
  employeeId: string;
  employeeName: string;
  entryDate: string;
}): Promise<void> {
  await notifyOrgAdmins({
    orgId: params.orgId,
    type: "time_entry_pending",
    title: `Time entry pending from ${params.employeeName}`,
    body: params.entryDate,
    entity: "time_entries",
    entityId: params.entryId,
    excludeUserId: params.employeeId,
  });
}
