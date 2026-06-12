import {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";

type EntrySlice = { entry_date: string; total_hours: number | null };

/** Derive week stats from entry rows already in hand — avoids a redundant DB query. */
export function weekStatsFromEntries(entries: EntrySlice[]): WeekStats {
  const rows = entries.filter(
    (e) => e.total_hours != null && !Number.isNaN(Number(e.total_hours)),
  );
  const daysLogged = new Set(rows.map((r) => r.entry_date)).size;
  const totalHours = rows.reduce((sum, r) => sum + Number(r.total_hours), 0);
  const overtime =
    totalHours > OVERTIME_HOURS_THRESHOLD
      ? Math.round((totalHours - OVERTIME_HOURS_THRESHOLD) * 100) / 100
      : 0;

  return {
    daysLogged,
    totalHours,
    canSubmit: daysLogged >= SUBMIT_MIN_DAYS || totalHours >= SUBMIT_MIN_HOURS,
    overtimeHours: overtime,
  };
}
