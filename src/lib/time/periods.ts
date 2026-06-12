import type { PeriodCadence } from "@/types/db";

export type PayPeriod = {
  start: string;
  end: string;
  label: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function mondayOfWeek(iso: string): string {
  const d = parseIso(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function formatLabel(start: string, end: string): string {
  const s = parseIso(start);
  const e = parseIso(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const year = e.getFullYear();
  const startStr = s.toLocaleDateString("en-AU", opts);
  const endStr = e.toLocaleDateString("en-AU", { ...opts, year: "numeric" });
  if (start === end) return endStr;
  return `${startStr} – ${endStr}`;
}

function monthPeriod(iso: string): PayPeriod {
  const d = parseIso(iso);
  const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = toIsoDate(last);
  return { start, end, label: formatLabel(start, end) };
}

function weeklyPeriod(iso: string): PayPeriod {
  const start = mondayOfWeek(iso);
  const end = addDays(start, 6);
  return {
    start,
    end,
    label: `Week of ${parseIso(start).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`,
  };
}

function biweeklyPeriod(iso: string): PayPeriod {
  const monday = mondayOfWeek(iso);
  const anchor = mondayOfWeek(`${parseIso(monday).getFullYear()}-01-01`);
  const diffDays = Math.floor(
    (parseIso(monday).getTime() - parseIso(anchor).getTime()) / 86_400_000,
  );
  const block = Math.floor(diffDays / 14);
  const start = addDays(anchor, block * 14);
  const end = addDays(start, 13);
  return { start, end, label: formatLabel(start, end) };
}

export function periodForDate(
  isoDate: string,
  cadence: PeriodCadence,
): PayPeriod {
  if (cadence === "monthly") return monthPeriod(isoDate);
  if (cadence === "biweekly") return biweeklyPeriod(isoDate);
  return weeklyPeriod(isoDate);
}

export function shiftPeriod(
  period: PayPeriod,
  cadence: PeriodCadence,
  direction: -1 | 1,
): PayPeriod {
  const mid = addDays(period.start, Math.floor(
    (parseIso(period.end).getTime() - parseIso(period.start).getTime()) /
      86_400_000 /
      2,
  ));
  const pivot = addDays(mid, direction * (cadence === "monthly" ? 15 : cadence === "biweekly" ? 14 : 7));
  return periodForDate(pivot, cadence);
}

export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function dayName(iso: string): string {
  return DAY_NAMES[parseIso(iso).getDay()]!;
}

/** Monday-start week clipped to pay period boundaries. */
export function weekDaysInPeriod(
  period: PayPeriod,
  weekStartIso: string,
): { date: string; dayName: string; isFuture: boolean; isToday: boolean }[] {
  const today = toIsoDate(new Date());
  const weekStart = mondayOfWeek(weekStartIso);
  const days: { date: string; dayName: string; isFuture: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    if (date < period.start || date > period.end) continue;
    days.push({
      date,
      dayName: dayName(date),
      isFuture: date > today,
      isToday: date === today,
    });
  }
  return days;
}

export function defaultWeekStart(period: PayPeriod, today = toIsoDate(new Date())): string {
  if (today >= period.start && today <= period.end) return today;
  return period.start;
}

export function countWorkingDays(start: string, end: string): number {
  let count = 0;
  for (const d of datesInRange(start, end)) {
    const dow = parseIso(d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
