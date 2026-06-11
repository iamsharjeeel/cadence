import {
  REQUIRED_FIELDS,
  type MappedRow,
  type RowErrors,
  type ValidatedRow,
} from "./types";

/**
 * Normalizes a date string to ISO `yyyy-mm-dd`, or null if unparseable.
 * Accepts ISO (`yyyy-mm-dd`), and slash/dash forms. For ambiguous numeric
 * forms it assumes month-first (US) unless the first part is clearly a day
 * (> 12), in which case it falls back to day-first.
 */
export function normalizeDate(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // ISO: yyyy-mm-dd (or yyyy/mm/dd)
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return buildDate(+y, +m, +d);
  }

  // d/m/yyyy or m/d/yyyy (also with dashes or dots)
  const parts = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (parts) {
    let [, a, b, y] = parts;
    let year = +y;
    if (year < 100) year += year < 70 ? 2000 : 1900;
    let month = +a;
    let day = +b;
    // If the first field can't be a month, treat it as day-first.
    if (month > 12 && day <= 12) {
      [month, day] = [day, month];
    }
    return buildDate(year, month, day);
  }

  // Last resort: let the engine try, then re-serialize as a local date.
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return buildDate(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate(),
    );
  }
  return null;
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates (e.g. Feb 30 rolling over).
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseHours(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

const TRUTHY = new Set(["true", "yes", "y", "1", "billable", "t"]);
const FALSY = new Set(["false", "no", "n", "0", "nonbillable", "non-billable", "f"]);

export function parseBillable(input: string): boolean {
  const value = input.trim().toLowerCase();
  if (FALSY.has(value)) return false;
  if (TRUTHY.has(value)) return true;
  return true; // default billable
}

/**
 * Validates one raw mapped row, producing normalized values + per-field errors.
 * Used identically on the client (live preview) and server (submit re-check) —
 * the single source of truth for what a valid row is.
 */
export function validateMappedRow(raw: MappedRow, id: string): ValidatedRow {
  const errors: RowErrors = {};

  const row_date = normalizeDate(raw.date);
  if (!raw.date.trim()) errors.date = "Date is required.";
  else if (!row_date) errors.date = "Unrecognized date format.";

  const hours = parseHours(raw.hours);
  if (!raw.hours.trim()) errors.hours = "Hours is required.";
  else if (hours === null) errors.hours = "Hours must be a number.";
  else if (hours <= 0 || hours > 24) errors.hours = "Hours must be 0–24.";

  const project = raw.project.trim() || null;
  const description = raw.description.trim() || null;
  const billable = parseBillable(raw.billable);

  // Guard against required fields slipping through (defensive).
  for (const f of REQUIRED_FIELDS) {
    if (!errors[f] && !raw[f].trim()) errors[f] = "Required.";
  }

  return {
    id,
    raw,
    row_date,
    hours,
    project,
    description,
    billable,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
