import { normalizeDate, parseHours, validateMappedRow } from "./validation";
import type {
  BuildOptions,
  ColumnMapping,
  MappedRow,
  RawTable,
  ValidatedRow,
} from "./types";

function cell(cells: string[], index: number | null): string {
  if (index === null || index < 0) return "";
  return (cells[index] ?? "").trim();
}

/** Reduces a raw table to canonical MappedRows using the column mapping. */
export function toMappedRows(
  table: RawTable,
  mapping: ColumnMapping,
): MappedRow[] {
  return table.rows.map((cells) => ({
    date: cell(cells, mapping.date),
    hours: cell(cells, mapping.hours),
    project: cell(cells, mapping.project),
    description: cell(cells, mapping.description),
    start_time: cell(cells, mapping.start_time),
    end_time: cell(cells, mapping.end_time),
    billable: cell(cells, mapping.billable),
  }));
}

// Words that mark a summary/total row when they appear in the date column.
const SUMMARY_RE = /\b(total|totals|sum|subtotal|grand|average|avg)\b/i;
const NUMERIC_RE = /^\d+([.,]\d+)?$/;
const WEEKDAYS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tue", "tues", "wed", "weds", "thu", "thur", "thurs", "fri", "sat", "sun",
]);

/**
 * Decides whether a row is a summary/label row that should be auto-excluded,
 * based on its date-column value: a summary keyword, or a value that is neither
 * a valid date, a number, nor a weekday name (e.g. "Total Weekday hours").
 */
function isSummaryDateCell(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (SUMMARY_RE.test(v)) return true;
  const lower = v.toLowerCase();
  if (WEEKDAYS.has(lower)) return false;
  return normalizeDate(v) === null && !NUMERIC_RE.test(v);
}

let counter = 0;
function nextId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `r${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Builds validated preview rows from a table + mapping, applying:
 *   1. summary/total row exclusion (label in the date column)
 *   2. forward-fill of blank date cells from the row above
 *   3. optional skip of zero-hour rows
 * then validating each surviving row.
 */
export function buildValidatedRows(
  table: RawTable,
  mapping: ColumnMapping,
  options: BuildOptions = { skipZeroHours: false },
): ValidatedRow[] {
  const mapped = toMappedRows(table, mapping);
  const out: ValidatedRow[] = [];
  let lastDate = "";

  for (const raw of mapped) {
    const dateCell = raw.date.trim();

    // 1. Drop summary/label rows outright.
    if (isSummaryDateCell(dateCell)) continue;

    // 2. Forward-fill blank date cells from the previous row.
    let filledDate = dateCell;
    if (!filledDate) filledDate = lastDate;
    else lastDate = filledDate;

    const filled: MappedRow = { ...raw, date: filledDate };

    // 3. Optionally skip zero-hour rows instead of flagging them.
    if (options.skipZeroHours && parseHours(filled.hours) === 0) continue;

    out.push(validateMappedRow(filled, nextId()));
  }

  return out;
}

const STORAGE_PREFIX = "cadence:tsmap:";

/** Persists a column mapping per org so repeat uploads skip the mapping step. */
export function saveMapping(orgSlug: string, mapping: ColumnMapping): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + orgSlug, JSON.stringify(mapping));
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

export function loadMapping(orgSlug: string): ColumnMapping | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + orgSlug);
    return raw ? (JSON.parse(raw) as ColumnMapping) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a stored mapping against the CURRENT table headers. A stored mapping
 * is only reusable when its required indexes still exist in this table.
 */
export function reconcileStoredMapping(
  stored: ColumnMapping | null,
  table: RawTable,
): ColumnMapping | null {
  if (!stored) return null;
  const max = table.headers.length - 1;
  for (const key of ["date", "hours"] as const) {
    const idx = stored[key];
    if (idx === null || idx === undefined || idx < 0 || idx > max) return null;
  }
  const clamp = (i: number | null | undefined) =>
    i !== null && i !== undefined && i >= 0 && i <= max ? i : null;
  return {
    date: stored.date,
    hours: stored.hours,
    project: clamp(stored.project),
    description: clamp(stored.description),
    start_time: clamp(stored.start_time),
    end_time: clamp(stored.end_time),
    billable: clamp(stored.billable),
  };
}
