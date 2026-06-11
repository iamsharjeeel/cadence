"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  detectHeaderOffset,
  parseCsvText,
  parsePastedText,
  prepareGoogleSheetTable,
  sampleCsv,
  tableFromGrid,
} from "@/lib/timesheets/parse";
import { autoMatch } from "@/lib/timesheets/columns";
import {
  buildValidatedRows,
  loadMapping,
  reconcileStoredMapping,
  saveMapping,
} from "@/lib/timesheets/map";
import {
  CANONICAL_FIELDS,
  type BuildOptions,
  type CanonicalField,
  type ColumnMapping,
  type Grid,
  type RawTable,
  type ValidatedRow,
} from "@/lib/timesheets/types";
import { submitTimesheet } from "../actions";
import { UploadDropzone } from "./UploadDropzone";
import { HeaderMapping } from "./HeaderMapping";
import { PreviewTable } from "./PreviewTable";

type Step = "input" | "map" | "preview" | "done";

const EMPTY_MAPPING: ColumnMapping = {
  date: null,
  hours: null,
  project: null,
  description: null,
  start_time: null,
  end_time: null,
  billable: null,
};

export function UploadWizard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("input");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [skipRows, setSkipRows] = useState(0);
  const [detectedSkip, setDetectedSkip] = useState(0);
  const [table, setTable] = useState<RawTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [autoMatched, setAutoMatched] = useState<Set<CanonicalField>>(new Set());
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [options, setOptions] = useState<BuildOptions>({ skipZeroHours: false });
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleSheetImport, setGoogleSheetImport] = useState(false);

  const maxSkip = grid ? Math.max(0, grid.rows.length - 1) : 0;

  // Clipboard paste (Method 2) — only while on the input step.
  useEffect(() => {
    if (step !== "input") return;
    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text/plain");
      if (!text || !text.trim()) return;
      const parsed = parsePastedText(text);
      if (parsed.rows.length === 0) return;
      e.preventDefault();
      toast("Paste detected — mapping your columns.", "success");
      applyGrid(parsed, null);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /** File upload + clipboard paste — original pipeline (no URL sanitization). */
  function applyGrid(g: Grid, rawFile: File | null) {
    setGoogleSheetImport(false);
    const detected = detectHeaderOffset(g);
    setGrid(g);
    setFile(rawFile);
    setDetectedSkip(detected);
    setSkipRows(detected);
    const tbl = tableFromGrid(g, detected);
    setTable(tbl);
    continueAfterTable(tbl);
  }

  function continueAfterTable(tbl: RawTable) {
    const stored = reconcileStoredMapping(loadMapping(orgSlug), tbl);
    if (stored) {
      setMapping(stored);
      setAutoMatched(new Set(CANONICAL_FIELDS.filter((f) => stored[f] !== null)));
      setRows(buildValidatedRows(tbl, stored, options));
      setStep("preview");
      return;
    }

    // First upload (no reusable mapping): always show the mapping step so the
    // user can confirm skip-rows and map any optional columns.
    const { mapping: auto, matched } = autoMatch(tbl);
    setMapping(auto);
    setAutoMatched(matched);
    setStep("map");
  }

  /** Google Sheets — sanitize single-cell URL rows, then same header detection. */
  function applyGoogleSheetGrid(g: Grid) {
    const { grid: cleaned, skip: detected, table: tbl } =
      prepareGoogleSheetTable(g);

    if (cleaned.rows.length === 0) {
      toast(
        "Couldn't parse sheet columns. Make sure the sheet has a header row with column names.",
        "error",
      );
      return;
    }

    setGoogleSheetImport(true);
    setGrid(cleaned);
    setFile(null);
    setDetectedSkip(detected);
    setSkipRows(detected);
    setTable(tbl);
    continueAfterTable(tbl);
  }

  /** Re-derive the header/table when the skip-rows offset changes. */
  function changeSkip(value: number) {
    if (!grid) return;
    const clamped = Math.max(0, Math.min(maxSkip, Math.floor(value)));
    setSkipRows(clamped);
    const tbl = googleSheetImport
      ? prepareGoogleSheetTable(grid, clamped).table
      : tableFromGrid(grid, clamped);
    setTable(tbl);
    const { mapping: auto, matched } = autoMatch(tbl);
    setMapping(auto);
    setAutoMatched(matched);
  }

  function toggleSkipZero(checked: boolean) {
    const next = { ...options, skipZeroHours: checked };
    setOptions(next);
    if (table) setRows(buildValidatedRows(table, mapping, next));
  }

  function confirmMapping() {
    if (mapping.date === null || mapping.hours === null) {
      toast("Map both Date and Hours to continue.", "error");
      return;
    }
    if (table) {
      saveMapping(orgSlug, mapping);
      setRows(buildValidatedRows(table, mapping, options));
      setStep("preview");
    }
  }

  async function fetchGoogleSheet() {
    if (!googleUrl.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/google-sheet?url=${encodeURIComponent(googleUrl)}`,
      );
      const json = (await res.json()) as { csv?: string; error?: string };
      if (!res.ok) {
        toast(
          json.error ??
            "Couldn't fetch sheet. Make sure it's published: File → Share → Publish to web → CSV.",
          "error",
        );
        return;
      }
      if (typeof json.csv !== "string" || !json.csv.trim()) {
        toast("That sheet came back empty.", "error");
        return;
      }
      const parsed = parseCsvText(json.csv);
      if (parsed.rows.length === 0) {
        toast("That sheet came back empty.", "error");
        return;
      }
      toast("Sheet imported.", "success");
      applyGoogleSheetGrid(parsed);
    } catch {
      toast(
        "Couldn't fetch sheet. Make sure it's published: File → Share → Publish to web → CSV.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadSample() {
    const blob = new Blob([sampleCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cadence-timesheet-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onSubmit() {
    const errorCount = rows.filter((r) => !r.isValid).length;
    if (rows.length === 0) {
      toast("Add at least one valid row.", "error");
      return;
    }
    if (errorCount > 0) {
      toast("Fix the highlighted rows before submitting.", "error");
      return;
    }
    if (!periodStart || !periodEnd) {
      toast("Choose a pay period.", "error");
      return;
    }
    if (periodStart > periodEnd) {
      toast("Period start must be on or before the end.", "error");
      return;
    }

    setBusy(true);
    const fd = new FormData();
    fd.set("period_start", periodStart);
    fd.set("period_end", periodEnd);
    fd.set("rows", JSON.stringify(rows.map((r) => r.raw)));
    if (file) fd.set("file", file);

    const result = await submitTimesheet(fd);
    setBusy(false);

    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    toast("Timesheet submitted.", "success");
    router.push("/app/timesheets");
  }

  function reset() {
    setStep("input");
    setGrid(null);
    setFile(null);
    setTable(null);
    setSkipRows(0);
    setDetectedSkip(0);
    setMapping(EMPTY_MAPPING);
    setAutoMatched(new Set());
    setRows([]);
    setGoogleUrl("");
    setGoogleSheetImport(false);
  }

  // ---- render ----
  if (step === "done") {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="Timesheet submitted"
            description="Taking you to your timesheets…"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (step === "input") {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Upload a file</CardTitle>
            <CardDescription>
              Drag &amp; drop or browse. CSV and Excel (.xlsx) supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadDropzone
              onParsed={(g, f) => applyGrid(g, f)}
              onError={(m) => toast(m, "error")}
            />
            <button
              type="button"
              onClick={downloadSample}
              className="mt-4 text-sm font-medium text-[var(--accent-strong)] hover:underline"
            >
              Download sample CSV template
            </button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Paste from Excel or Sheets</CardTitle>
              <CardDescription>
                Copy your rows, then press ⌘/Ctrl + V anywhere on this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-[var(--radius)] border border-dashed px-4 py-6 text-center text-sm text-muted">
                Waiting for paste…
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import a Google Sheet</CardTitle>
              <CardDescription>
                Publish your sheet to the web, then paste its link.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input
                placeholder="https://docs.google.com/spreadsheets/…"
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
              />
              <div>
                <Button size="sm" onClick={fetchGoogleSheet} disabled={busy}>
                  {busy ? "Importing…" : "Import sheet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "map" && table) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map your columns</CardTitle>
          <CardDescription>
            Skip any metadata rows, then confirm the column mapping. Date and
            Hours are required; everything else is optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <HeaderMapping
            table={table}
            mapping={mapping}
            autoMatched={autoMatched}
            onChange={(field, index) =>
              setMapping((m) => ({ ...m, [field]: index }))
            }
            skipRows={skipRows}
            maxSkip={maxSkip}
            detectedSkip={detectedSkip}
            onSkipChange={changeSkip}
          />
          <div className="flex gap-3">
            <Button onClick={confirmMapping}>Continue to preview</Button>
            <Button variant="ghost" onClick={reset}>
              Start over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // preview
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pay period</CardTitle>
          <CardDescription>
            Select the period this timesheet covers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <Input
              label="Period start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <Input
              label="Period end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Preview &amp; validate</CardTitle>
              <CardDescription>
                Invalid rows are highlighted — fix them in the source or remove
                them. Summary rows are excluded and blank dates carry down
                automatically.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={options.skipZeroHours}
                  onChange={(e) => toggleSkipZero(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Skip zero-hour rows
              </label>
              <Button variant="ghost" size="sm" onClick={() => setStep("map")}>
                Adjust columns
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PreviewTable
            rows={rows}
            showStartTime={mapping.start_time !== null}
            showEndTime={mapping.end_time !== null}
            onDelete={(id) => setRows((rs) => rs.filter((r) => r.id !== id))}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onSubmit} disabled={busy}>
          {busy ? "Submitting…" : "Submit timesheet"}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy}>
          Start over
        </Button>
      </div>
    </div>
  );
}
