import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { RawTable } from "./types";

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

function toRawTable(rows: string[][]): RawTable {
  const cleaned = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  if (cleaned.length === 0) return { headers: [], rows: [] };
  const [headers, ...body] = cleaned;
  return {
    headers: headers.map((h) => String(h ?? "").trim()),
    rows: body.map((r) => r.map((c) => String(c ?? ""))),
  };
}

/** Parses delimited text (CSV by default, TSV when pasted from a spreadsheet). */
export function parseDelimited(text: string, delimiter?: string): RawTable {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: "greedy",
  });
  return toRawTable(result.data as string[][]);
}

export function parseCsvText(text: string): RawTable {
  return parseDelimited(text);
}

/** Pasted spreadsheet content is tab-separated. */
export function parsePastedText(text: string): RawTable {
  const delimiter = text.includes("\t") ? "\t" : "";
  return parseDelimited(text, delimiter || undefined);
}

export async function parseXlsxFile(file: File): Promise<RawTable> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return toRawTable(rows as string[][]);
}

export async function parseFile(file: File, kind: FileKind): Promise<RawTable> {
  if (kind === "xlsx") return parseXlsxFile(file);
  const text = await file.text();
  return parseCsvText(text);
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
