import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOvernightShift,
  rangesOverlap,
  toRange,
} from "@/lib/time/validation";
import type { TimesheetStatus } from "@/types/db";

export function editableStatus(status: TimesheetStatus): boolean {
  return status === "draft" || status === "submitted" || status === "rejected";
}

export async function assertEditableTimesheet(
  timesheetId: string,
  employeeId: string,
) {
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, status, employee_id, org_id")
    .eq("id", timesheetId)
    .single();
  if (!ts) return { ok: false as const, message: "Timesheet not found." };
  if (ts.employee_id !== employeeId) {
    return { ok: false as const, message: "Not authorized." };
  }
  if (!editableStatus(ts.status as TimesheetStatus)) {
    return { ok: false as const, message: "This timesheet is locked." };
  }
  return { ok: true as const, ts };
}

export async function checkOverlap(
  employeeId: string,
  entryDate: string,
  startTime: string,
  endTime: string,
  overnight: boolean,
  excludeId?: string,
): Promise<string | null> {
  const range = toRange(startTime, endTime, overnight);
  if (!range) return "Invalid time range.";
  const db = createAdminClient();
  const { data: siblings } = await db
    .from("time_entries")
    .select("id, start_time, end_time")
    .eq("employee_id", employeeId)
    .eq("entry_date", entryDate);
  for (const sibling of siblings ?? []) {
    if (excludeId && sibling.id === excludeId) continue;
    const otherStart = String(sibling.start_time).slice(0, 5);
    const otherEnd = String(sibling.end_time).slice(0, 5);
    const other = toRange(
      otherStart,
      otherEnd,
      isOvernightShift(otherStart, otherEnd),
    );
    if (other && rangesOverlap(range, other)) {
      return "This entry overlaps another on the same day.";
    }
  }
  return null;
}
