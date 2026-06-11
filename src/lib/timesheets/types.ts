/**
 * Canonical timesheet columns the pipeline understands.
 *
 * `start_time` / `end_time` are optional passthrough columns: they are mapped
 * and carried through, but never required. On normalization they are folded
 * into the description (e.g. "09:00–17:00 · Homepage build") since the schema
 * has no dedicated time columns.
 */
export const CANONICAL_FIELDS = [
  "date",
  "hours",
  "project",
  "description",
  "start_time",
  "end_time",
  "billable",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_FIELDS: CanonicalField[] = ["date", "hours"];

/** The raw parsed grid: every non-empty row, no header extracted yet. */
export type Grid = {
  rows: string[][];
};

/** A parsed spreadsheet: a chosen header row plus aligned string cells. */
export type RawTable = {
  headers: string[];
  rows: string[][];
};

/** Maps each canonical field to a header index (or null when unmapped). */
export type ColumnMapping = Record<CanonicalField, number | null>;

/**
 * A single row reduced to canonical fields, still as raw strings. This is the
 * shape sent to the server, which re-validates every value from scratch.
 */
export type MappedRow = {
  date: string;
  hours: string;
  project: string;
  description: string;
  start_time: string;
  end_time: string;
  billable: string;
};

/** Options applied while building preview rows from a table + mapping. */
export type BuildOptions = {
  /** Drop rows whose hours resolve to 0 instead of flagging them as errors. */
  skipZeroHours: boolean;
};

/** Validation outcome for one row (keyed by the fields that can error). */
export type RowErrors = Partial<Record<CanonicalField, string>>;

export type ValidatedRow = {
  /** Stable client-side id for list operations (delete, keys). */
  id: string;
  raw: MappedRow;
  /** Normalized values when valid. */
  row_date: string | null;
  hours: number | null;
  project: string | null;
  description: string | null;
  billable: boolean;
  errors: RowErrors;
  isValid: boolean;
};
