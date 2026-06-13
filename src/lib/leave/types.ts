export type LeaveUnit = "days" | "hours";

export const LEAVE_UNITS = ["days", "hours"] as const satisfies readonly LeaveUnit[];

/** Display label — e.g. "30 days", "8.0h", "0.5 days". */
export function formatLeaveAmount(amount: number, unit: LeaveUnit): string {
  const rounded = Math.round(amount * 10) / 10;
  const str =
    Number.isInteger(rounded) || rounded % 1 === 0
      ? String(Math.trunc(rounded) === rounded ? rounded : rounded.toFixed(1))
      : rounded.toFixed(1);

  if (unit === "hours") return `${str}h`;
  return `${str} ${amount === 1 ? "day" : "days"}`;
}

/** Error / toast copy — e.g. "8 hours", "0.5 days". */
export function formatLeaveRemaining(amount: number, unit: LeaveUnit): string {
  const rounded = Math.round(amount * 10) / 10;
  const str =
    Number.isInteger(rounded) || rounded % 1 === 0
      ? String(Math.trunc(rounded) === rounded ? rounded : rounded.toFixed(1))
      : rounded.toFixed(1);

  if (unit === "hours") return `${str} hours`;
  return `${str} ${amount === 1 ? "day" : "days"}`;
}
