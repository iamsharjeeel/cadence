"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  shiftWeekMonday,
  thisWeekMonday,
  isoWeekLabel,
} from "@/lib/time/periods";
import { getWeekOverview, type WeekOverviewRow } from "./time-actions";
import type { TimesheetStatus } from "@/types/db";

type FilterOption = TimesheetStatus | "none" | "all";

type SortBy = "name" | "hours" | "status";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<TimesheetStatus | "none", number> = {
  submitted: 0,
  rejected: 1,
  draft: 2,
  approved: 3,
  none: 4,
};

function sortRows(
  rows: WeekOverviewRow[],
  sortBy: SortBy,
  sortDir: SortDir,
): WeekOverviewRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = a.employeeName.localeCompare(b.employeeName);
    } else if (sortBy === "hours") {
      cmp = a.totalHours - b.totalHours;
    } else if (sortBy === "status") {
      cmp =
        (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="border-b last:border-b-0">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--line)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--line)]" />
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--line)]" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-12 animate-pulse rounded bg-[var(--line)]" />
          </td>
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  );
}

export function TimesheetWeekOverview({
  initialWeekMonday,
}: {
  initialWeekMonday: string;
}) {
  const router = useRouter();
  const [weekMonday, setWeekMonday] = useState(initialWeekMonday);
  const [rows, setRows] = useState<WeekOverviewRow[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const currentWeek = thisWeekMonday();
  const isCurrentWeek = weekMonday === currentWeek;
  const isoLabel = isoWeekLabel(weekMonday);

  const fetchData = useCallback(
    async (monday: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getWeekOverview(monday);
        if (result.ok) {
          setRows(result.rows);
          setWeekLabel(result.weekLabel);
        } else {
          setError(result.message);
        }
      } catch {
        setError("Failed to load week overview.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchData(weekMonday);
  }, [weekMonday, fetchData]);

  function handleSortClick(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  function sortIndicator(col: SortBy) {
    if (sortBy !== col) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const filteredRows = rows.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const sortedRows = sortRows(filteredRows, sortBy, sortDir);

  const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
    { label: "All", value: "all" },
    { label: "Submitted", value: "submitted" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "No entry", value: "none" },
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle>Week overview</CardTitle>
            <CardDescription>
              {weekLabel && (
                <span>
                  {weekLabel}
                  <span className="ml-2 font-mono text-xs opacity-60">
                    {isoLabel}
                  </span>
                </span>
              )}
            </CardDescription>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setWeekMonday((m) => shiftWeekMonday(m, -1))
              }
            >
              ← Prev
            </Button>
            <Button
              variant={isCurrentWeek ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setWeekMonday(thisWeekMonday())}
            >
              This week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setWeekMonday((m) => shiftWeekMonday(m, 1))
              }
            >
              Next →
            </Button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === opt.value
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-muted hover:bg-[var(--line)] hover:text-[var(--ink)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="px-6 py-8 text-center text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    <button
                      className="flex items-center gap-1 hover:text-[var(--accent-strong)]"
                      onClick={() => handleSortClick("name")}
                    >
                      Employee{sortIndicator("name")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    <button
                      className="flex items-center gap-1 hover:text-[var(--accent-strong)]"
                      onClick={() => handleSortClick("status")}
                    >
                      Status{sortIndicator("status")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    <button
                      className="flex items-center gap-1 hover:text-[var(--accent-strong)]"
                      onClick={() => handleSortClick("hours")}
                    >
                      Hours{sortIndicator("hours")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-sm text-muted"
                    >
                      No timesheets for this week.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {sortedRows.map((row, index) => (
                      <motion.tr
                        key={row.employeeId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{
                          duration: 0.16,
                          delay: index * 0.04,
                        }}
                        className={cn(
                          "border-b last:border-b-0 transition-colors",
                          row.timesheetId
                            ? "cursor-pointer hover:bg-[var(--accent-soft)]/40"
                            : "",
                        )}
                        onClick={() => {
                          if (row.timesheetId) {
                            router.push(
                              `/app/timesheets/${row.timesheetId}`,
                            );
                          }
                        }}
                      >
                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-strong)]"
                              aria-hidden
                            >
                              {row.avatarInitials}
                            </div>
                            <span className="font-medium text-[var(--ink)]">
                              {row.employeeName}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.status === "none" ? (
                              <span className="text-xs text-muted">
                                No timesheet
                              </span>
                            ) : (
                              <TimesheetStatusPill
                                status={row.status as TimesheetStatus}
                              />
                            )}
                            {row.resubmitCount > 0 &&
                              row.status === "submitted" && (
                                <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-strong)]">
                                  Resubmitted
                                </span>
                              )}
                          </div>
                        </td>

                        {/* Hours */}
                        <td className="tnum px-4 py-3 font-medium text-[var(--ink)]">
                          {row.totalHours.toFixed(1)}h
                        </td>

                        {/* Action */}
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.status === "submitted" &&
                          row.timesheetId ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/app/timesheets/${row.timesheetId}`,
                                )
                              }
                            >
                              Review
                            </Button>
                          ) : row.status === "approved" ? (
                            <span className="text-sm text-muted">
                              Approved ✓
                            </span>
                          ) : null}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
