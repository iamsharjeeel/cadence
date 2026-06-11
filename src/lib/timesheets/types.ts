/** Canonical timesheet columns the pipeline understands. */
export const CANONICAL_FIELDS = [
  "date",
  "hours",
  "project",
  "description",
  "billable",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_FIELDS: CanonicalField[] = ["date", "hours"];

/** A parsed spreadsheet: a header row plus aligned string cells. */
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
  billable: string;
};

/** Validation outcome for one row. */
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
