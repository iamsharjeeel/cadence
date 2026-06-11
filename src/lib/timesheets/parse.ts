import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { Grid, RawTable } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];
// Explicitly rejected — macro-enabled workbooks and everything else.
const REJECTED_EXTENSIONS = [".xlsm", ".xltm", ".xlsb", ".xls"];

const CSV_MIME = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel", // some browsers tag .csv as this
  "",
]);
const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "",
]);

export type FileKind = "csv" | "xlsx";

export type FileCheck =
  | { ok: true; kind: FileKind }
  | { ok: false; error: string };

/** Client-side gate: extension + MIME + size. Re-checked server-side too. */
export function checkFile(file: File): FileCheck {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));

  if (REJECTED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: "Macro-enabled and legacy Excel files aren't allowed." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is larger than 10MB." };
  }

  if (ext === ".csv") {
    if (!CSV_MIME.has(file.type))
      return { ok: false, error: "That doesn't look like a CSV file." };
    return { ok: true, kind: "csv" };
  }
  if (ext === ".xlsx") {
    if (!XLSX_MIME.has(file.type))
      return { ok: false, error: "That doesn't look like an .xlsx file." };
    return { ok: true, kind: "xlsx" };
  }
  return { ok: false, error: "Only .csv and .xlsx files are supported." };
}

function toGrid(rows: string[][]): Grid {
  // Keep only rows with at least one non-empty cell.
  const cleaned = rows
    .map((r) => r.map((c) => String(c ?? "")))
    .filter((r) => r.some((c) => c.trim() !== ""));
  return { rows: cleaned };
}

/** Parses delimited text (CSV by default, TSV when pasted from a spreadsheet). */
export function parseDelimited(text: string, delimiter?: string): Grid {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: "greedy",
  });
  return toGrid(result.data as string[][]);
}

export function parseCsvText(text: string): Grid {
  return parseDelimited(text);
}

/** Pasted spreadsheet content is tab-separated. */
export function parsePastedText(text: string): Grid {
  const delimiter = text.includes("\t") ? "\t" : "";
  return parseDelimited(text, delimiter || undefined);
}

export async function parseXlsxFile(file: File): Promise<Grid> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return toGrid(rows as string[][]);
}

export async function parseFile(file: File, kind: FileKind): Promise<Grid> {
  if (kind === "xlsx") return parseXlsxFile(file);
  const text = await file.text();
  return parseCsvText(text);
}

function nonEmptyCount(row: string[]): number {
  return row.filter((c) => String(c).trim() !== "").length;
}

const URL_LIKE = /^https?:\/\//i;

function isUrlLikeCell(value: string): boolean {
  const v = value.trim();
  return URL_LIKE.test(v) || v.includes("docs.google.com/spreadsheets");
}

/** Rows that are sheet links, titles, or other pre-header metadata. */
function isJunkLeadingRow(row: string[]): boolean {
  const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (cells.length === 0) return true;
  if (cells.length === 1 && isUrlLikeCell(cells[0]!)) return true;
  if (cells.every(isUrlLikeCell)) return true;
  return false;
}

/**
 * Strips leading blank / URL / title rows before header detection.
 * Shared by file upload, paste, and Google Sheets import.
 */
export function sanitizeImportGrid(grid: Grid): Grid {
  let start = 0;
  while (start < grid.rows.length && isJunkLeadingRow(grid.rows[start]!)) {
    start += 1;
  }
  if (start === 0) return grid;
  return { rows: grid.rows.slice(start) };
}

/**
 * Full import pipeline: sanitize → detect header offset → derive table.
 * Used by all three upload methods so behaviour is identical.
 */
export function prepareImportTable(
  grid: Grid,
  skipOverride?: number,
): { grid: Grid; skip: number; table: RawTable } {
  const cleaned = sanitizeImportGrid(grid);
  const detected = detectHeaderOffset(cleaned);
  const skip = skipOverride ?? detected;
  const table = tableFromGrid(cleaned, skip);
  return { grid: cleaned, skip, table };
}

function normalizeHeaderCell(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Recognises the common payroll export layout:
 *   DAY | DATE | START TIME | END TIME | TOTAL HOURS
 */
function isPayrollHeaderRow(row: string[]): boolean {
  const cells = row.map((c) => normalizeHeaderCell(String(c ?? "")));
  const hasDate = cells.includes("date");
  const hasHours =
    cells.includes("totalhours") ||
    cells.includes("hours") ||
    cells.includes("totalhrs");
  const hasTime =
    cells.includes("starttime") ||
    cells.includes("endtime") ||
    cells.includes("start") ||
    cells.includes("end");
  return hasDate && hasHours && (hasTime || cells.includes("day"));
}

/**
 * Auto-detects how many top rows to skip before the real header. Spreadsheets
 * often carry title/metadata rows (1–2 cells wide) above a wide header row.
 *
 * Strategy:
 *   1. Look for the known payroll header signature (DAY|DATE|…|TOTAL HOURS).
 *   2. Fall back to mode-of-widths: the data region dominates row count, so the
 *      most common row width marks where columns stabilise.
 */
export function detectHeaderOffset(grid: Grid): number {
  const payrollIdx = grid.rows.findIndex(
    (row) => !isJunkLeadingRow(row) && isPayrollHeaderRow(row),
  );
  if (payrollIdx >= 0) return payrollIdx;

  const widths = grid.rows.map(nonEmptyCount);
  const candidates = widths
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => w >= 2 && !isJunkLeadingRow(grid.rows[i]!));
  if (candidates.length === 0) return 0;

  const filteredWidths = candidates.map((c) => c.w);
  const freq = new Map<number, number>();
  for (const w of filteredWidths) freq.set(w, (freq.get(w) ?? 0) + 1);
  let mode = 0;
  let best = -1;
  for (const [w, count] of freq) {
    if (count > best || (count === best && w > mode)) {
      best = count;
      mode = w;
    }
  }

  const match = candidates.find(({ w }) => w >= mode);
  return match?.i ?? 0;
}

/** Derives a header+body table from a grid, skipping `skip` leading rows. */
export function tableFromGrid(grid: Grid, skip: number): RawTable {
  const clamped = Math.max(0, Math.min(skip, Math.max(0, grid.rows.length - 1)));
  const header = grid.rows[clamped] ?? [];
  const body = grid.rows.slice(clamped + 1);
  return {
    headers: header.map((h) => String(h ?? "").trim()),
    rows: body.map((r) => r.map((c) => String(c ?? ""))),
  };
}

/** Generates a sample CSV template (client-side download, no server needed). */
export function sampleCsv(): string {
  const rows = [
    ["Date", "Hours", "Project", "Description", "Billable"],
    ["2026-06-01", "8", "Acme Website", "Homepage build", "true"],
    ["2026-06-02", "6.5", "Acme Website", "Design review", "true"],
    ["2026-06-03", "4", "Internal", "Team sync", "false"],
  ];
  return rows.map((r) => r.join(",")).join("\n");
}
