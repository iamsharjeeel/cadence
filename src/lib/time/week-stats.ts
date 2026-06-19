import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { durationHours } from "@/lib/time/validation";
import type { PeriodCadence } from "@/types/db";
import {
  canSubmitPeriod,
  submitThresholds,
  type WeekStats,
} from "@/lib/time/week-constants";

export {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  canSubmitPeriod,
  submitThresholds,
  type WeekStats,
} from "@/lib/time/week-constants";

/** @deprecated Use canSubmitPeriod with cadence */
export function canSubmitWeek(daysLogged: number, totalHours: number): boolean {
  return canSubmitPeriod(daysLogged, totalHours, "weekly");
}

export function overtimeHours(
  totalHours: number,
  cadence: PeriodCadence = "weekly",
): number {
  const threshold = submitThresholds(cadence).overtimeHours;
  if (totalHours <= threshold) return 0;
  return Math.round((totalHours - threshold) * 100) / 100;
}

/** Server-side period totals from persisted time_entries. */
export async function computeWeekStats(
  timesheetId: string,
  cadence: PeriodCadence = "weekly",
): Promise<WeekStats> {
  const db = createAdminClient();
  const { data: entries } = await db
    .from("time_entries")
    .select("entry_date, start_time, end_time, entry_mode, decimal_hours")
    .eq("timesheet_id", timesheetId);

  const rows = entries ?? [];
  const daysLogged = new Set(rows.map((r) => r.entry_date)).size;
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
  const ot = overtimeHours(totalHours, cadence);

  return {
    daysLogged,
    totalHours,
    canSubmit: canSubmitPeriod(daysLogged, totalHours, cadence),
    overtimeHours: ot,
  };
}
