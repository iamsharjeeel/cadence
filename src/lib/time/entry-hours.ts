import { durationHours } from "@/lib/time/validation";

type EntryHoursSource = {
  entry_mode?: string | null;
  decimal_hours?: number | null;
  start_time?: string | null;
  end_time?: string | null;
};

type PersistedHoursSource = EntryHoursSource & {
  total_hours?: number | null;
};

function calculatedHours(row: EntryHoursSource): number | null {
  if (row.entry_mode === "decimal_hours" && row.decimal_hours != null) {
    return Number(row.decimal_hours);
  }
  if (!row.start_time || !row.end_time) return null;
  return durationHours(
    String(row.start_time).slice(0, 5),
    String(row.end_time).slice(0, 5),
  );
}

/** Preserve callers that fall back to the persisted generated value. */
export function entryHoursWithPersistedFallback(
  row: PersistedHoursSource,
): number {
  return calculatedHours(row) ?? Number(row.total_hours);
}

/** Preserve callers that use a persisted value only when source times are absent. */
export function entryHoursWithOptionalPersistedFallback(
  row: PersistedHoursSource,
): number {
  if (row.entry_mode === "decimal_hours" && row.decimal_hours != null) {
    return Number(row.decimal_hours);
  }
  if (row.start_time && row.end_time) return calculatedHours(row) ?? 0;
  return Number(row.total_hours ?? 0);
}

/** Preserve callers that always use zero when source times cannot be calculated. */
export function entryHoursWithZeroFallback(row: EntryHoursSource): number {
  return calculatedHours(row) ?? 0;
}
