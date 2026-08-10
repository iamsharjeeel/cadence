import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { entryHoursWithZeroFallback } from "@/lib/time/entry-hours";
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
  return entryHoursWithZeroFallback(row);
}

export async function getPendingTimeEntries(
  orgId: string,
): Promise<PendingTimeEntry[]> {
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
