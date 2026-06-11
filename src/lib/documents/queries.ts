import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/db";

export type TimesheetDocCandidate = {
  id: string;
  employee_id: string;
  employeeName: string;
  org_id: string;
  orgName?: string;
  period_start: string;
  period_end: string;
  calculated_total: number;
  currency_snapshot: string | null;
};

/**
 * Approved timesheets without a document yet.
 * Admin: scoped to profile.org_id. Superadmin: all orgs, or filtered by orgId.
 */
export async function getApprovedTimesheetsWithoutDocuments(
  profile: Profile,
  orgId?: string | null,
): Promise<TimesheetDocCandidate[]> {
  if (profile.role !== "admin" && profile.role !== "superadmin") {
    return [];
  }

  const db = createAdminClient();

  let tsQuery = db
    .from("timesheets")
    .select(
      "id, employee_id, org_id, period_start, period_end, calculated_total, currency_snapshot",
    )
    .eq("status", "approved")
    .not("calculated_total", "is", null);

  if (profile.role === "admin") {
    if (!profile.org_id) return [];
    tsQuery = tsQuery.eq("org_id", profile.org_id);
  } else if (orgId) {
    tsQuery = tsQuery.eq("org_id", orgId);
  }

  const [{ data: timesheets, error: tsErr }, { data: documents }] =
    await Promise.all([
      tsQuery.order("period_start", { ascending: false }),
      db.from("documents").select("timesheet_id"),
    ]);

  if (tsErr) {
    console.error(
      "[documents] getApprovedTimesheetsWithoutDocuments:",
      tsErr.message,
    );
    return [];
  }

  const documented = new Set(
    (documents ?? []).map((d) => d.timesheet_id as string),
  );
  const pending = (timesheets ?? []).filter((t) => !documented.has(t.id));
  if (pending.length === 0) return [];

  const employeeIds = [...new Set(pending.map((t) => t.employee_id))];
  const orgIds = [...new Set(pending.map((t) => t.org_id))];

  const [{ data: people }, { data: orgs }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", employeeIds),
    profile.role === "superadmin"
      ? db.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map<string, string>();
  for (const p of people ?? []) {
    nameById.set(p.id, p.full_name?.trim() || p.email);
  }

  const orgNameById = new Map<string, string>();
  for (const o of orgs ?? []) {
    orgNameById.set(o.id, o.name);
  }

  return pending.map((t) => ({
    id: t.id,
    employee_id: t.employee_id,
    employeeName: nameById.get(t.employee_id) ?? "—",
    org_id: t.org_id,
    orgName: orgNameById.get(t.org_id),
    period_start: t.period_start,
    period_end: t.period_end,
    calculated_total: t.calculated_total as number,
    currency_snapshot: t.currency_snapshot,
  }));
}
