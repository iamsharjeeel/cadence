"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Download } from "lucide-react";

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
import { UPLOAD_SECTION_ITEM, UPLOAD_SECTION_STAGGER } from "@/lib/motion";
import {
  detectHeaderOffset,
  isSpreadsheetUrlOnly,
  parsePastedText,
  sampleCsv,
  tableFromGrid,
} from "@/lib/timesheets/parse";
import { autoMatch, canAutoSkipMapping } from "@/lib/timesheets/columns";
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

function OrDivider() {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-line" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-surface px-3 text-xs font-medium uppercase tracking-wide text-muted">
          or
        </span>
      </div>
    </div>
  );
}

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
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);

  const maxSkip = grid ? Math.max(0, grid.rows.length - 1) : 0;

  function applyParsedGrid(g: Grid, rawFile: File | null) {
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

    const { mapping: auto, matched } = autoMatch(tbl);
    setMapping(auto);
    setAutoMatched(matched);

    if (canAutoSkipMapping(auto, matched)) {
      saveMapping(orgSlug, auto);
      setRows(buildValidatedRows(tbl, auto, options));
      toast("Auto-mapped successfully.", "success");
      setStep("preview");
      return;
    }

    setStep("map");
  }

  function changeSkip(value: number) {
    if (!grid) return;
    const clamped = Math.max(0, Math.min(maxSkip, Math.floor(value)));
    setSkipRows(clamped);
    const tbl = tableFromGrid(grid, clamped);
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

  function mappingHasRequiredFields(m: ColumnMapping): boolean {
    if (m.date === null) return false;
    if (m.hours !== null) return true;
    return m.start_time !== null && m.end_time !== null;
  }

  function confirmMapping() {
    if (!mappingHasRequiredFields(mapping)) {
      toast("Map Date and Hours (or Start + End time) to continue.", "error");
      return;
    }
    if (table) {
      saveMapping(orgSlug, mapping);
      setRows(buildValidatedRows(table, mapping, options));
      setStep("preview");
    }
  }

  function handlePasteData(text: string) {
    setPasteText(text);
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isSpreadsheetUrlOnly(trimmed)) {
      toast("Paste table data, not a link. Copy cells from your sheet first.", "error");
      return;
    }
    const parsed = parsePastedText(trimmed);
    if (parsed.rows.length === 0) {
      toast("Couldn't parse that data. Copy cells from Excel or Google Sheets.", "error");
      return;
    }
    applyParsedGrid(parsed, null);
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
    setPasteText("");
  }

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
      <Card>
        <CardHeader>
          <CardTitle>Add your timesheet</CardTitle>
          <CardDescription>
            Upload a file or paste spreadsheet data — both paths use the same
            mapping and preview flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div
            className="flex flex-col gap-6"
            variants={UPLOAD_SECTION_STAGGER}
            initial="hidden"
            animate="show"
          >
            <motion.section variants={UPLOAD_SECTION_ITEM} className="flex flex-col gap-3">
              <h3 className="font-display text-base font-medium tracking-tightest text-ink">
                Upload a file
              </h3>
              <UploadDropzone
                onParsed={(g, f) => applyParsedGrid(g, f)}
                onError={(m) => toast(m, "error")}
              />
              <div className="flex flex-col gap-3 rounded-[var(--radius)] border-l-4 border-[var(--accent)] bg-[rgba(31,138,138,0.08)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink">
                  For best results, use our sample template
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={downloadSample}
                  className="shrink-0 border border-[var(--accent)]/30 bg-surface/80 text-[var(--accent-strong)] hover:bg-surface"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  Download sample CSV
                </Button>
              </div>
            </motion.section>

            <motion.div variants={UPLOAD_SECTION_ITEM}>
              <OrDivider />
            </motion.div>

            <motion.section variants={UPLOAD_SECTION_ITEM} className="flex flex-col gap-3">
              <h3 className="font-display text-base font-medium tracking-tightest text-ink">
                Paste from Excel or Google Sheets
              </h3>
              <label htmlFor="paste-data" className="text-sm font-medium text-ink">
                Paste your data here
              </label>
              <textarea
                id="paste-data"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text/plain");
                  if (text) {
                    e.preventDefault();
                    handlePasteData(text);
                  }
                }}
                placeholder="Copy cells from Excel or Google Sheets (Ctrl+C), then paste here (Ctrl+V)"
                rows={8}
                className="w-full resize-y rounded-[var(--radius)] border bg-surface px-3 py-2.5 font-mono text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
              />
              <p className="text-xs text-muted">
                In Google Sheets: select your data range → Ctrl+C → click above and
                Ctrl+V.
              </p>
            </motion.section>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  if (step === "map" && table) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map your columns</CardTitle>
          <CardDescription>
            Skip any metadata rows, then confirm the column mapping. Date and
            Hours (or Start + End time) are required; everything else is optional.
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
