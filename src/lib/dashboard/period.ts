/** Returns ISO date strings for the current calendar month. */
export function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
}

/** ISO week key (YYYY-Www) for a date string. */
export function isoWeekKey(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Last N ISO weeks ending this week, oldest first. */
export function lastNWeeks(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    out.push(isoWeekKey(toIsoDate(d)));
  }
  return [...new Set(out)];
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
