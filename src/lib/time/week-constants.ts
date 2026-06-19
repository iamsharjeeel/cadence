import type { PeriodCadence } from "@/types/db";

/** Weekly timesheet submission thresholds (default / personal workspace). */
export const SUBMIT_MIN_DAYS = 5;
export const SUBMIT_MIN_HOURS = 40;
export const OVERTIME_HOURS_THRESHOLD = 40;

export type WeekStats = {
  daysLogged: number;
  totalHours: number;
  canSubmit: boolean;
  overtimeHours: number;
};

export type SubmitThresholds = {
  minDays: number;
  minHours: number;
  overtimeHours: number;
};

export function submitThresholds(cadence: PeriodCadence): SubmitThresholds {
  switch (cadence) {
    case "monthly":
      return { minDays: 20, minHours: 160, overtimeHours: 160 };
    case "biweekly":
    case "biweekly_15":
      return { minDays: 10, minHours: 80, overtimeHours: 80 };
    case "weekly":
    default:
      return {
        minDays: SUBMIT_MIN_DAYS,
        minHours: SUBMIT_MIN_HOURS,
        overtimeHours: OVERTIME_HOURS_THRESHOLD,
      };
  }
}

export function canSubmitPeriod(
  daysLogged: number,
  totalHours: number,
  cadence: PeriodCadence,
): boolean {
  const t = submitThresholds(cadence);
  return daysLogged >= t.minDays || totalHours >= t.minHours;
}
