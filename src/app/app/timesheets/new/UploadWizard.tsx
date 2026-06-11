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
import { parseCsvText, parsePastedText, sampleCsv } from "@/lib/timesheets/parse";
import { autoMatch } from "@/lib/timesheets/columns";
import {
  buildValidatedRows,
  loadMapping,
  reconcileStoredMapping,
  saveMapping,
} from "@/lib/timesheets/map";
import {
  CANONICAL_FIELDS,
  type CanonicalField,
  type ColumnMapping,
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
  billable: null,
};

export function UploadWizard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("input");
  const [table, setTable] = useState<RawTable | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [autoMatched, setAutoMatched] = useState<Set<CanonicalField>>(new Set());
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // Clipboard paste (Method 2) — only while on the input step.
  useEffect(() => {
    if (step !== "input") return;
    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text/plain");
      if (!text || !text.trim()) return;
      const parsed = parsePastedText(text);
      if (parsed.headers.length === 0) return;
      e.preventDefault();
      toast("Paste detected — mapping your columns.", "success");
      ingest(parsed, null);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /** Shared entry point for all three input methods. */
  function ingest(parsed: RawTable, rawFile: File | null) {
    setTable(parsed);
    setFile(rawFile);

    const stored = reconcileStoredMapping(loadMapping(orgSlug), parsed);
    if (stored) {
      setMapping(stored);
      setAutoMatched(new Set(CANONICAL_FIELDS.filter((f) => stored[f] !== null)));
      setRows(buildValidatedRows(parsed, stored));
      setStep("preview");
      return;
    }

    const { mapping: auto, matched } = autoMatch(parsed);
    setMapping(auto);
    setAutoMatched(matched);

    const allMatched = CANONICAL_FIELDS.every((f) => matched.has(f));
    if (allMatched) {
      setRows(buildValidatedRows(parsed, auto));
      setStep("preview");
    } else {
      setStep("map");
    }
  }

  function confirmMapping() {
    if (mapping.date === null || mapping.hours === null) {
      toast("Map both Date and Hours to continue.", "error");
      return;
    }
    if (table) {
      saveMapping(orgSlug, mapping);
      setRows(buildValidatedRows(table, mapping));
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
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Couldn't import that sheet.", "error");
        return;
      }
      const parsed = parseCsvText(json.csv);
      if (parsed.headers.length === 0) {
        toast("That sheet came back empty.", "error");
        return;
      }
      toast("Sheet imported.", "success");
      ingest(parsed, null);
    } catch {
      toast("Couldn't import that sheet.", "error");
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
    setStep("done");
    setTimeout(() => router.push("/app/timesheets"), 1400);
  }

  function reset() {
    setStep("input");
    setTable(null);
    setFile(null);
    setMapping(EMPTY_MAPPING);
    setAutoMatched(new Set());
    setRows([]);
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
              onParsed={(t, f) => ingest(t, f)}
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
            We matched what we could — confirm the rest. Date and Hours are
            required.
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
          <CardTitle>Preview &amp; validate</CardTitle>
          <CardDescription>
            Review every row. Invalid rows are highlighted — fix them in the
            source or remove them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreviewTable
            rows={rows}
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
