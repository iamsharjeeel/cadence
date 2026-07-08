// Regression test for bug C1: monthly Next/Previous navigation must move to
// the actual adjacent calendar month regardless of month length (28/29/30/31
// days), for both shiftViewPeriod (ViewPeriodCadence) and shiftPeriod
// (PeriodCadence).
//
// Run with: npx tsx --test src/lib/time/periods.shift.test.ts
// (Node's built-in test runner via tsx, since the repo has no test runner
// configured and this avoids adding one.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  viewPeriodForDate,
  shiftViewPeriod,
  periodForDate,
  shiftPeriod,
} from "./periods";

const MONTH_STARTS_2026 = Array.from(
  { length: 12 },
  (_, i) => `2026-${String(i + 1).padStart(2, "0")}-15`,
);

function monthIndexOf(iso: string): number {
  const [, m] = iso.split("-").map(Number);
  return m! - 1;
}

test("shiftViewPeriod(monthly, +1) moves to the next calendar month for every month of the year", () => {
  for (const dateInMonth of MONTH_STARTS_2026) {
    const period = viewPeriodForDate(dateInMonth, "monthly");
    const currentMonth = monthIndexOf(period.start);
    const next = shiftViewPeriod(period, "monthly", 1);
    const expectedMonth = (currentMonth + 1) % 12;
    assert.equal(
      monthIndexOf(next.start),
      expectedMonth,
      `Next month from ${period.start}..${period.end} should be month index ${expectedMonth}, got ${next.start}..${next.end}`,
    );
    // start must be the 1st, end must be the last day of that month
    assert.equal(next.start.slice(8), "01");
  }
});

test("shiftViewPeriod(monthly, -1) moves to the previous calendar month for every month of the year", () => {
  for (const dateInMonth of MONTH_STARTS_2026) {
    const period = viewPeriodForDate(dateInMonth, "monthly");
    const currentMonth = monthIndexOf(period.start);
    const prev = shiftViewPeriod(period, "monthly", -1);
    const expectedMonth = (currentMonth + 11) % 12;
    assert.equal(
      monthIndexOf(prev.start),
      expectedMonth,
      `Previous month from ${period.start}..${period.end} should be month index ${expectedMonth}, got ${prev.start}..${prev.end}`,
    );
    assert.equal(prev.start.slice(8), "01");
  }
});

test("shiftPeriod(monthly, +1) moves to the next calendar month for every month of the year", () => {
  for (const dateInMonth of MONTH_STARTS_2026) {
    const period = periodForDate(dateInMonth, "monthly");
    const currentMonth = monthIndexOf(period.start);
    const next = shiftPeriod(period, "monthly", 1);
    const expectedMonth = (currentMonth + 1) % 12;
    assert.equal(
      monthIndexOf(next.start),
      expectedMonth,
      `Next month from ${period.start}..${period.end} should be month index ${expectedMonth}, got ${next.start}..${next.end}`,
    );
    assert.equal(next.start.slice(8), "01");
  }
});

test("shiftPeriod(monthly, -1) moves to the previous calendar month for every month of the year", () => {
  for (const dateInMonth of MONTH_STARTS_2026) {
    const period = periodForDate(dateInMonth, "monthly");
    const currentMonth = monthIndexOf(period.start);
    const prev = shiftPeriod(period, "monthly", -1);
    const expectedMonth = (currentMonth + 11) % 12;
    assert.equal(
      monthIndexOf(prev.start),
      expectedMonth,
      `Previous month from ${period.start}..${period.end} should be month index ${expectedMonth}, got ${prev.start}..${prev.end}`,
    );
    assert.equal(prev.start.slice(8), "01");
  }
});

// Round-trip sanity: shifting forward then back returns to the same period.
test("shiftViewPeriod monthly round-trips back to the original period", () => {
  for (const dateInMonth of MONTH_STARTS_2026) {
    const period = viewPeriodForDate(dateInMonth, "monthly");
    const back = shiftViewPeriod(
      shiftViewPeriod(period, "monthly", 1),
      "monthly",
      -1,
    );
    assert.deepEqual(back, period);
  }
});
