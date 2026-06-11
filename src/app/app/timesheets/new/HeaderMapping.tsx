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
}: {
  table: RawTable;
  mapping: ColumnMapping;
  autoMatched: Set<CanonicalField>;
  onChange: (field: CanonicalField, index: number | null) => void;
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
