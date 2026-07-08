import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { trustRequiredOrgScope } from "@/lib/org-scope";
import { durationHours } from "@/lib/time/validation";
import type { TimeEntry } from "@/types/db";

export type PendingTimeEntry = Pick<
  TimeEntry,
  | "id"
  | "employee_id"
  | "entry_date"
  | "start_time"
  | "end_time"
  | "decimal_hours"
  | "entry_mode"
  | "description"
  | "billable"
  | "created_at"
> & { employee_name: string; hours: number };

function entryHours(row: {
  entry_mode: string | null;
  decimal_hours: number | null;
  start_time: string | null;
  end_time: string | null;
}): number {
  if (row.entry_mode === "decimal_hours" && row.decimal_hours != null) {
    return Number(row.decimal_hours);
  }
  if (row.start_time && row.end_time) {
    return (
      durationHours(
        String(row.start_time).slice(0, 5),
        String(row.end_time).slice(0, 5),
      ) ?? 0
    );
  }
  return 0;
}

export async function getPendingTimeEntries(
  orgId: string,
): Promise<PendingTimeEntry[]> {
  // Defense-in-depth: re-assert the caller's org matches the requested one.
  orgId = await trustRequiredOrgScope(orgId);
  const db = createAdminClient();
  const { data } = await db
    .from("time_entries")
    .select(
      "id, employee_id, entry_date, start_time, end_time, decimal_hours, entry_mode, description, billable, created_at",
    )
    .eq("org_id", orgId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  if (!rows.length) return [];

  const employeeIds = [...new Set(rows.map((r) => r.employee_id as string))];
  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", employeeIds);

  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]),
  );

  return rows.map((row) => ({
    ...(row as PendingTimeEntry),
    employee_name: nameById.get(row.employee_id as string) ?? "Unknown",
    hours: entryHours(row as PendingTimeEntry),
  }));
}
