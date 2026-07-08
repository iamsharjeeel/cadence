import type { RateType } from "@/types/db";

/**
 * Rounds a dollar amount to the nearest cent.
 *
 * Plain `Math.round(x * 100) / 100` mis-rounds values that land on (or near)
 * a half-cent boundary because the multiplication can't be represented
 * exactly in binary floating point (e.g. `1.005 * 100 === 100.49999999999999`,
 * which rounds down to `1` instead of `1.01`). Re-rendering the intermediate
 * value through `toPrecision(15)` strips that binary noise before rounding,
 * which recovers the decimal value the caller actually intended regardless
 * of magnitude.
 */
export function roundToCents(amount: number): number {
  return Math.round(Number((amount * 100).toPrecision(15))) / 100;
}

/**
 * Computes a timesheet total from snapshotted rate inputs.
 *   - hourly:           sum(hours) × rate
 *   - salaried / fixed: rate as-is (hours are informational)
 * Returns null when no rate is set.
 */
export function calculateTotal(
  totalHours: number,
  rate: number | null,
  rateType: RateType,
): number | null {
  if (rate === null || rate === undefined) return null;
  const total = rateType === "hourly" ? totalHours * rate : rate;
  return roundToCents(total);
}
