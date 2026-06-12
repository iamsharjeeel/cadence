"use client";

import { Select } from "@/components/ui/Select";
import { isUrlLikeCell } from "@/lib/timesheets/parse";
import {
  CANONICAL_FIELDS,
  REQUIRED_FIELDS,
  type CanonicalField,
  type ColumnMapping,
  type RawTable,
} from "@/lib/timesheets/types";
import { titleCase } from "@/lib/utils";

/**
 * Lets the user review and adjust column mapping. All fields are shown as
 * dropdowns, pre-filled with auto-detected matches where available.
 */
export function HeaderMapping({
  table,
  mapping,
  onChange,
  skipRows,
  maxSkip,
  detectedSkip,
  onSkipChange,
}: {
  table: RawTable;
  mapping: ColumnMapping;
  onChange: (field: CanonicalField, index: number | null) => void;
  skipRows: number;
  maxSkip: number;
  detectedSkip: number;
  onSkipChange: (value: number) => void;
}) {
  const headerOptions = (Array.isArray(table.headers) ? table.headers : [])
    .map((h, i) => ({ label: h, index: i }))
    .filter(({ label }) => label.trim() !== "" && !isUrlLikeCell(label));

  const options = (field: CanonicalField) => [
    {
      label: REQUIRED_FIELDS.includes(field) ? "Select a column…" : "Not mapped",
      value: "",
    },
    ...headerOptions.map(({ label, index }) => ({
      label: label || `Column ${index + 1}`,
      value: String(index),
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
            {Array.isArray(table.headers)
              ? table.headers.filter(Boolean).join(" · ")
              : "—"}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CANONICAL_FIELDS.map((field) => (
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
    </div>
  );
}
