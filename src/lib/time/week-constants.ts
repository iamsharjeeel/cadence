/** Weekly timesheet submission thresholds (shared client + server). */
export const SUBMIT_MIN_DAYS = 5;
export const SUBMIT_MIN_HOURS = 40;
export const OVERTIME_HOURS_THRESHOLD = 40;

export type WeekStats = {
  daysLogged: number;
  totalHours: number;
  canSubmit: boolean;
  overtimeHours: number;
};
