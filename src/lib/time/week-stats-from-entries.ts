import {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";
import { entryHoursWithOptionalPersistedFallback } from "@/lib/time/entry-hours";

type EntrySlice = {
  entry_date: string;
  total_hours?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  entry_mode?: string | null;
  decimal_hours?: number | null;
};

/** Hours for a slice, wrapping overnight — never the negative generated column. */
function sliceHours(e: EntrySlice): number {
  return entryHoursWithOptionalPersistedFallback(e);
}

/** Derive week stats from entry rows already in hand — avoids a redundant DB query. */
export function weekStatsFromEntries(entries: EntrySlice[]): WeekStats {
  const daysLogged = new Set(entries.map((r) => r.entry_date)).size;
  const totalHours =
    Math.round(entries.reduce((sum, r) => sum + sliceHours(r), 0) * 100) / 100;
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
