import type { RateType } from "@/types/db";

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
  return Math.round(total * 100) / 100;
}
