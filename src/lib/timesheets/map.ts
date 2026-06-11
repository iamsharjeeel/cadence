import { validateMappedRow } from "./validation";
import type {
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
    billable: cell(cells, mapping.billable),
  }));
}

/** Builds validated preview rows with stable ids from a raw table + mapping. */
export function buildValidatedRows(
  table: RawTable,
  mapping: ColumnMapping,
): ValidatedRow[] {
  return toMappedRows(table, mapping).map((raw, i) =>
    validateMappedRow(raw, `${i}-${Math.random().toString(36).slice(2, 8)}`),
  );
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
    if (idx === null || idx < 0 || idx > max) return null;
  }
  // Clamp any optional indexes that no longer exist.
  const clamp = (i: number | null) => (i !== null && i >= 0 && i <= max ? i : null);
  return {
    date: stored.date,
    hours: stored.hours,
    project: clamp(stored.project),
    description: clamp(stored.description),
    billable: clamp(stored.billable),
  };
}
