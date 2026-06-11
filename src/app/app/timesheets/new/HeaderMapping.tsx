"use client";

import { Select } from "@/components/ui/Select";
import { titleCase } from "@/lib/utils";
import {
  CANONICAL_FIELDS,
  REQUIRED_FIELDS,
  type CanonicalField,
  type ColumnMapping,
  type RawTable,
} from "@/lib/timesheets/types";

/**
 * Lets the user map canonical fields to spreadsheet columns. Only fields that
 * couldn't be confidently auto-matched are surfaced; the rest are summarized.
 */
export function HeaderMapping({
  table,
  mapping,
  autoMatched,
  onChange,
  skipRows,
  maxSkip,
  detectedSkip,
  onSkipChange,
}: {
  table: RawTable;
  mapping: ColumnMapping;
  autoMatched: Set<CanonicalField>;
  onChange: (field: CanonicalField, index: number | null) => void;
  skipRows: number;
  maxSkip: number;
  detectedSkip: number;
  onSkipChange: (value: number) => void;
}) {
  const needsMapping = CANONICAL_FIELDS.filter((f) => !autoMatched.has(f));

  const options = (field: CanonicalField) => [
    {
      label: REQUIRED_FIELDS.includes(field) ? "Select a column…" : "Not mapped",
      value: "",
    },
    ...table.headers.map((h, i) => ({
      label: h || `Column ${i + 1}`,
      value: String(i),
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-[var(--radius)] border bg-[var(--accent-soft)]/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="skip-rows" className="text-sm font-medium text-ink">
              Skip top rows
            </label>
            <input
              id="skip-rows"
              type="number"
              min={0}
              max={maxSkip}
              value={skipRows}
              onChange={(e) => {
                const n = Number(e.target.value);
                onSkipChange(Number.isFinite(n) ? n : 0);
              }}
              className="h-9 w-24 rounded-[var(--radius)] border bg-surface px-3 text-sm tnum focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
            />
          </div>
          <p className="pb-2 text-xs text-muted">
            Metadata rows above the header are skipped.{" "}
            {detectedSkip > 0
              ? `Auto-detected ${detectedSkip}.`
              : "Auto-detected 0."}
          </p>
        </div>
        <p className="text-xs text-muted">
          Header row preview:{" "}
          <span className="text-ink">
            {table.headers.filter(Boolean).join(" · ") || "—"}
          </span>
        </p>
      </div>

      {autoMatched.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...autoMatched].map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-strong)]"
            >
              ✓ {titleCase(f)} → {table.headers[mapping[f]!] || "column"}
            </span>
          ))}
        </div>
      )}

      {needsMapping.length === 0 ? (
        <p className="text-sm text-muted">
          Every column was matched automatically.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {needsMapping.map((field) => (
            <Select
              key={field}
              label={`${titleCase(field)}${
                REQUIRED_FIELDS.includes(field) ? " *" : ""
              }`}
              value={mapping[field] === null ? "" : String(mapping[field])}
              options={options(field)}
              onChange={(e) =>
                onChange(field, e.target.value === "" ? null : Number(e.target.value))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
