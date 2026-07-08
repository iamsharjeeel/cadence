/**
 * Synthetic start/end times for decimal-hours mode.
 *
 * Live `total_hours` is GENERATED ALWAYS from start_time/end_time (time difference
 * in hours). Using reference start `00:00` and end = start + N hours produces
 * exactly N total_hours when Postgres computes (end_time - start_time).
 */

// Strictly under 24h: exactly 24 wraps decimalHoursToEndTime back to 00:00,
// so end_time == start_time and the generated total_hours column reads 0.
const MAX_DECIMAL_HOURS = 23.99;

export type EntryMode = "time_range" | "decimal_hours";

export function parseDecimalHours(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_DECIMAL_HOURS) return null;
  return Math.round(n * 100) / 100;
}

/** Convert decimal hours to HH:MM end time from 00:00 reference start. */
export function decimalHoursToEndTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const DECIMAL_HOURS_REFERENCE_START = "00:00";

export function syntheticTimesForDecimalHours(hours: number): {
  start_time: string;
  end_time: string;
} {
  return {
    start_time: DECIMAL_HOURS_REFERENCE_START,
    end_time: decimalHoursToEndTime(hours),
  };
}

export function canPersistDecimalEntry(decimalHours: string): boolean {
  return parseDecimalHours(decimalHours) !== null;
}
