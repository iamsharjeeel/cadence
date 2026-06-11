"use client";

import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CountUp } from "@/components/motion/CountUp";
import { cn } from "@/lib/utils";
import type { CanonicalField, ValidatedRow } from "@/lib/timesheets/types";

const ERROR_BG = "bg-[rgba(220,38,38,0.08)]";

export function PreviewTable({
  rows,
  onDelete,
  showStartTime = false,
  showEndTime = false,
}: {
  rows: ValidatedRow[];
  onDelete: (id: string) => void;
  showStartTime?: boolean;
  showEndTime?: boolean;
}) {
  const errorCount = rows.filter((r) => !r.isValid).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="tnum font-semibold">
          <CountUp value={rows.length} /> rows
        </span>
        <span className="text-muted">·</span>
        <span
          className={cn(
            "tnum font-semibold",
            errorCount > 0 ? "text-[var(--danger)]" : "text-[var(--accent-strong)]",
          )}
        >
          {errorCount} {errorCount === 1 ? "error" : "errors"}
        </span>
        {errorCount > 0 && (
          <span className="text-muted">· fix before submitting.</span>
        )}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-[var(--radius)] border">
        <Table>
          <THead className="sticky top-0 bg-surface">
            <TR>
              <TH>Date</TH>
              {showStartTime && <TH>Start</TH>}
              {showEndTime && <TH>End</TH>}
              <TH>Hours</TH>
              <TH>Project</TH>
              <TH>Description</TH>
              <TH>Billable</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id} className={cn(!r.isValid && ERROR_BG)}>
                <Cell row={r} field="date">
                  {r.raw.date || "—"}
                </Cell>
                {showStartTime && (
                  <Cell row={r} field="start_time">
                    {r.raw.start_time || "—"}
                  </Cell>
                )}
                {showEndTime && (
                  <Cell row={r} field="end_time">
                    {r.raw.end_time || "—"}
                  </Cell>
                )}
                <Cell row={r} field="hours">
                  <span className="inline-flex items-center gap-2">
                    <span>
                      {r.hours !== null
                        ? r.hours
                        : r.raw.hours || "—"}
                    </span>
                    {r.hoursSource && (
                      <Badge tone={r.hoursSource === "calc" ? "accent" : "muted"}>
                        {r.hoursSource === "calc" ? "calc" : "manual"}
                      </Badge>
                    )}
                  </span>
                </Cell>
                <Cell row={r} field="project">
                  {r.raw.project || "—"}
                </Cell>
                <Cell row={r} field="description">
                  {r.raw.description || "—"}
                </Cell>
                <Cell row={r} field="billable">
                  {String(r.billable)}
                </Cell>
                <TD className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(r.id)}
                    aria-label="Delete row"
                  >
                    Remove
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function Cell({
  row,
  field,
  children,
}: {
  row: ValidatedRow;
  field: CanonicalField;
  children: React.ReactNode;
}) {
  const error = row.errors[field];
  return (
    <TD className={cn("text-sm", error ? "text-[var(--danger)]" : "")}>
      <span className="tnum">{children}</span>
      {error && <span className="block text-xs">{error}</span>}
    </TD>
  );
}
