const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseTime(value: string): string | null {
  const v = value.trim();
  if (!TIME_RE.test(v)) return null;
  const [h, m] = v.split(":");
  return `${h!.padStart(2, "0")}:${m}`;
}

export function hoursBetween(start: string, end: string, overnight: boolean): number | null {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return null;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  let startMin = sh! * 60 + sm!;
  let endMin = eh! * 60 + em!;
  if (overnight || endMin <= startMin) endMin += 24 * 60;
  if (endMin <= startMin) return null;
  return Math.round(((endMin - startMin) / 60) * 100) / 100;
}

/**
 * Correct positive duration (hours) for ANY start/end pair, wrapping past
 * midnight when end <= start (overnight). e.g. 23:30→00:15 = 0.75h,
 * 22:00→02:00 = 4h, 09:00→17:00 = 8h.
 *
 * Use this for all display/aggregation — NEVER the DB `total_hours` column,
 * which is GENERATED as (end - start)/3600 and goes negative for overnight.
 */
export function durationHours(start: string, end: string): number | null {
  return hoursBetween(start, end, isOvernightShift(start, end));
}

export function isOvernightShift(start: string, end: string): boolean {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return false;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return eh! * 60 + em! <= sh! * 60 + sm!;
}

/** Derived from clock times — end before start on the same calendar day. */
export function deriveIsOvernight(start: string, end: string): boolean {
  return isOvernightShift(start, end);
}

/** Overnight entries skip same-day overlap validation. */
export function shouldSkipOverlapCheck(start: string, end: string): boolean {
  return deriveIsOvernight(start, end);
}

export type TimeRange = { startMin: number; endMin: number };

export function toRange(start: string, end: string, overnight: boolean): TimeRange | null {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return null;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  let startMin = sh! * 60 + sm!;
  let endMin = eh! * 60 + em!;
  if (overnight || endMin <= startMin) endMin += 24 * 60;
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}
