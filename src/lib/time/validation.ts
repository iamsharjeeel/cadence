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

export function isOvernightShift(start: string, end: string): boolean {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return false;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return eh! * 60 + em! <= sh! * 60 + sm!;
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
