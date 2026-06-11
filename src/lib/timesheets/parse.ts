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

/**
 * Auto-detects how many top rows to skip before the real header. Spreadsheets
 * often carry title/metadata rows (1–2 cells wide) above a wide header row.
 *
 * Strategy: the data region dominates row count, so the most common row width
 * (the "mode", computed over rows at least 2 cells wide) marks where columns
 * stabilise. The header is the first row that reaches that width.
 */
export function detectHeaderOffset(grid: Grid): number {
  const widths = grid.rows.map(nonEmptyCount);
  const candidates = widths.filter((w) => w >= 2);
  if (candidates.length === 0) return 0;

  // Mode of widths; ties resolve to the larger width.
  const freq = new Map<number, number>();
  for (const w of candidates) freq.set(w, (freq.get(w) ?? 0) + 1);
  let mode = 0;
  let best = -1;
  for (const [w, count] of freq) {
    if (count > best || (count === best && w > mode)) {
      best = count;
      mode = w;
    }
  }

  const idx = widths.findIndex((w) => w >= mode);
  return idx === -1 ? 0 : idx;
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
