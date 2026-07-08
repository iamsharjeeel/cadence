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
  // Identical start/end is a zero-duration entry, never a 24h shift — reject
  // it regardless of the overnight flag (a caller may force overnight=true).
  if (startMin === endMin) return null;
  if (overnight || endMin < startMin) endMin += 24 * 60;
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
  // Strictly earlier end means the shift wraps past midnight. Equal times are
  // NOT overnight — they are zero-duration and rejected by the duration/range
  // helpers.
  return eh! * 60 + em! < sh! * 60 + sm!;
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
  // Zero-duration (identical start/end) is invalid regardless of overnight.
  if (startMin === endMin) return null;
  if (overnight || endMin < startMin) endMin += 24 * 60;
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}
