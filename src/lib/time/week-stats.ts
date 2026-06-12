import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";

export {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";

export function canSubmitWeek(daysLogged: number, totalHours: number): boolean {
  return daysLogged >= SUBMIT_MIN_DAYS || totalHours >= SUBMIT_MIN_HOURS;
}

export function overtimeHours(totalHours: number): number {
  if (totalHours <= OVERTIME_HOURS_THRESHOLD) return 0;
  return Math.round((totalHours - OVERTIME_HOURS_THRESHOLD) * 100) / 100;
}

/** Server-side week totals from persisted time_entries. */
export async function computeWeekStats(timesheetId: string): Promise<WeekStats> {
  const db = createAdminClient();
  const { data: entries } = await db
    .from("time_entries")
    .select("entry_date, total_hours")
    .eq("timesheet_id", timesheetId);

  const rows = entries ?? [];
  const daysLogged = new Set(rows.map((r) => r.entry_date)).size;
  const totalHours = rows.reduce((sum, r) => sum + Number(r.total_hours), 0);
  const ot = overtimeHours(totalHours);

  return {
    daysLogged,
    totalHours,
    canSubmit: canSubmitWeek(daysLogged, totalHours),
    overtimeHours: ot,
  };
}
