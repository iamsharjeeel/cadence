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

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function mondayOfWeek(iso: string): string {
  const d = parseIso(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

export function thisWeekMonday(today = toIsoDate(new Date())): string {
  return mondayOfWeek(today);
}

export function shiftWeekMonday(weekMonday: string, direction: -1 | 1): string {
  return addDays(weekMonday, direction * 7);
}

/** Mon–Sun week used as the timesheet submission unit. */
export function weekPeriodFromMonday(weekMonday: string): PayPeriod {
  const end = addDays(weekMonday, 6);
  return {
    start: weekMonday,
    end,
    label: formatLabel(weekMonday, end),
  };
}

/** ISO-8601 week label, e.g. 2026-W24 */
export function isoWeekLabel(weekMonday: string): string {
  const d = parseIso(weekMonday);
  const thursday = new Date(d);
  thursday.setDate(thursday.getDate() + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week =
    1 +
    Math.floor(
      (thursday.getTime() - yearStart.getTime()) / 86_400_000 -
        ((yearStart.getDay() + 6) % 7) +
        3) /
      7;
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type WeekDayRow = {
  date: string;
  dayName: string;
  isFuture: boolean;
  isToday: boolean;
  isWeekend: boolean;
};

/** Monday–Sunday rows for the weekly log view. */
export function weekDays(weekMonday: string): WeekDayRow[] {
  const today = toIsoDate(new Date());
  const days: WeekDayRow[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekMonday, i);
    const dow = parseIso(date).getDay();
    days.push({
      date,
      dayName: dayName(date),
      isFuture: date > today,
      isToday: date === today,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

/** @deprecated Use weekDays — Mon–Sun including optional weekends. */
export function workingWeekDays(weekMonday: string): WeekDayRow[] {
  return weekDays(weekMonday).filter((d) => !d.isWeekend);
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

export type PersonalPeriodType = "week" | "15day" | "30day";

function halfMonthPeriod(iso: string): PayPeriod {
  const d = parseIso(iso);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (d.getDate() <= 15) {
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-15`;
    return { start, end, label: formatLabel(start, end) };
  }
  const start = `${year}-${pad(month)}-16`;
  const last = new Date(year, month, 0);
  const end = toIsoDate(last);
  return { start, end, label: formatLabel(start, end) };
}

export function personalPeriodForDate(date: string, type: PersonalPeriodType): PayPeriod {
  if (type === "week") return weeklyPeriod(date);
  if (type === "15day") return halfMonthPeriod(date);
  return monthPeriod(date);
}

export function shiftPersonalPeriod(
  period: PayPeriod,
  type: PersonalPeriodType,
  direction: -1 | 1,
): PayPeriod {
  if (type === "week") {
    const newStart = addDays(period.start, direction * 7);
    return weeklyPeriod(newStart);
  }
  if (type === "15day") {
    const pivot = addDays(period.start, direction * 16);
    return halfMonthPeriod(pivot);
  }
  const d = parseIso(period.start);
  const newMonth = new Date(d.getFullYear(), d.getMonth() + direction, 1);
  return monthPeriod(toIsoDate(newMonth));
}

export function allDaysInPeriod(period: PayPeriod): WeekDayRow[] {
  const today = toIsoDate(new Date());
  return datesInRange(period.start, period.end).map((date) => {
    const dow = parseIso(date).getDay();
    return {
      date,
      dayName: dayName(date),
      isFuture: date > today,
      isToday: date === today,
      isWeekend: dow === 0 || dow === 6,
    };
  });
}
