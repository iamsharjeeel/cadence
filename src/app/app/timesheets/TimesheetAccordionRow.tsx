"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";

import { TimesheetStatusPill } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { durationHours } from "@/lib/time/validation";
import type { TimesheetStatus } from "@/types/db";
import { getTimesheetEntriesReadOnly } from "./time-actions";
import type { TimeEntryWithProject } from "@/types/time-tracking";
import { cn } from "@/lib/utils";

export type TimesheetAccordionRow = {
  id: string;
  period_start: string;
  period_end: string;
  status: TimesheetStatus;
  employeeName?: string;
};

function formatEntryHours(entry: TimeEntryWithProject): string {
  const hrs =
    entry.entry_mode === "decimal_hours" && entry.decimal_hours != null
      ? Number(entry.decimal_hours)
      : durationHours(
          String(entry.start_time).slice(0, 5),
          String(entry.end_time).slice(0, 5),
        ) ?? Number(entry.total_hours);
  return `${hrs.toFixed(1)}h`;
}

function EntryDaySummary({ entries }: { entries: TimeEntryWithProject[] }) {
  const byDay = new Map<string, TimeEntryWithProject[]>();
  for (const e of entries) {
    const list = byDay.get(e.entry_date) ?? [];
    list.push(e);
    byDay.set(e.entry_date, list);
  }

  const days = [...byDay.keys()].sort();

  if (days.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted">No entries in this period.</p>;
  }

  return (
    <div className="divide-y divide-[var(--line)] border-t border-[var(--line)] bg-surface-low">
      {days.map((date) => (
        <div key={date} className="px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            {formatDate(date)}
          </p>
          <ul className="flex flex-col gap-1.5">
            {(byDay.get(date) ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-ink">
                  {entry.project?.name ??
                    entry.asana_project_name ??
                    "No project"}
                  {entry.description ? (
                    <span className="text-muted"> — {entry.description}</span>
                  ) : null}
                </span>
                <span className="tabular text-muted">
                  {String(entry.start_time).slice(0, 5)}–
                  {String(entry.end_time).slice(0, 5)} · {formatEntryHours(entry)}
                  {!entry.billable ? " · non-billable" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TimesheetAccordionRow({
  row,
  showEmployee,
}: {
  row: TimesheetAccordionRow;
  showEmployee?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<TimeEntryWithProject[] | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      startTransition(async () => {
        const res = await getTimesheetEntriesReadOnly(row.id);
        if (res.ok && "entries" in res) {
          setEntries(res.entries);
        }
      });
    }
  }

  return (
    <div className="border-b border-[var(--line)] last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-low"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          {showEmployee && row.employeeName ? (
            <span className="text-sm font-medium text-ink">{row.employeeName}</span>
          ) : null}
          <span className="tabular text-sm text-ink">
            {formatDate(row.period_start)} – {formatDate(row.period_end)}
          </span>
          <TimesheetStatusPill status={row.status} />
        </div>
        {pending && open && entries === null ? (
          <span className="text-xs text-muted">Loading…</span>
        ) : null}
      </button>
      {open ? (
        entries ? (
          <EntryDaySummary entries={entries} />
        ) : pending ? null : (
          <p className="border-t border-[var(--line)] px-4 py-3 text-sm text-muted">
            Couldn&apos;t load entries.
          </p>
        )
      ) : null}
    </div>
  );
}
