/** Count weekdays (Mon–Fri) between two ISO dates inclusive. */
export function countBusinessDays(
  start: string,
  end: string,
  halfDay = false,
): number {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  if (s > e) return 0;

  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }

  if (halfDay && count > 0) return 0.5;
  return count;
}
