import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { durationHours } from "@/lib/time/validation";
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
    .select("entry_date, start_time, end_time, entry_mode, decimal_hours")
    .eq("timesheet_id", timesheetId);

  const rows = entries ?? [];
  const daysLogged = new Set(rows.map((r) => r.entry_date)).size;
  // Compute with overnight wrapping — never sum the generated `total_hours`
  // column, which is negative for overnight ranges (end < start).
  const totalHours =
    Math.round(
      rows.reduce((sum, r) => {
        const hrs =
          r.entry_mode === "decimal_hours" && r.decimal_hours != null
            ? Number(r.decimal_hours)
            : durationHours(
                String(r.start_time).slice(0, 5),
                String(r.end_time).slice(0, 5),
              ) ?? 0;
        return sum + hrs;
      }, 0) * 100,
    ) / 100;
  const ot = overtimeHours(totalHours);

  return {
    daysLogged,
    totalHours,
    canSubmit: canSubmitWeek(daysLogged, totalHours),
    overtimeHours: ot,
  };
}
