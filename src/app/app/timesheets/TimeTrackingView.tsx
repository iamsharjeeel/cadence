"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { hoursBetween, isOvernightShift } from "@/lib/time/validation";
import {
  defaultWeekStart,
  shiftPeriod,
  toIsoDate,
  weekDaysInPeriod,
  countWorkingDays,
  type PayPeriod,
} from "@/lib/time/periods";
import type { PeriodCadence, TimesheetStatus } from "@/types/db";
import type { Project, TimeEntryWithProject } from "@/types/time-tracking";
import {
  deleteTimeEntry,
  getTimeTrackingData,
  submitTimesheetForApproval,
  upsertTimeEntry,
} from "./time-actions";
import { createProject } from "../projects/actions";

type DraftEntry = {
  clientId: string;
  id?: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  project_id: string | null;
  description: string;
  billable: boolean;
  overnightConfirmed?: boolean;
  error?: string;
  saving?: boolean;
};

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function mondayOfWeek(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function newDraft(date: string, lastEnd?: string): DraftEntry {
  return {
    clientId: crypto.randomUUID(),
    entry_date: date,
    start_time: lastEnd ?? "09:00",
    end_time: lastEnd ? "" : "17:00",
    project_id: null,
    description: "",
    billable: true,
  };
}

function entryToDraft(e: TimeEntryWithProject): DraftEntry {
  return {
    clientId: e.id,
    id: e.id,
    entry_date: e.entry_date,
    start_time: formatTime(e.start_time),
    end_time: formatTime(e.end_time),
    project_id: e.project_id,
    description: e.description ?? "",
    billable: e.billable,
    overnightConfirmed: e.is_overnight,
  };
}

export function TimeTrackingView({
  initialPeriod,
  cadence,
}: {
  initialPeriod: PayPeriod;
  cadence: PeriodCadence;
}) {
  const { toast } = useToast();
  const [period, setPeriod] = useState(initialPeriod);
  const [weekStart, setWeekStart] = useState(defaultWeekStart(initialPeriod));
  const [timesheetId, setTimesheetId] = useState("");
  const [status, setStatus] = useState<TimesheetStatus>("draft");
  const [projects, setProjects] = useState<Project[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, DraftEntry[]>>({});
  const [rate, setRate] = useState<number | null>(null);
  const [rateType, setRateType] = useState("hourly");
  const [currency, setCurrency] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const editable = status === "draft" || status === "rejected";
  const weekDays = useMemo(
    () => weekDaysInPeriod(period, weekStart),
    [period, weekStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getTimeTrackingData(period.start, period.end);
    setLoading(false);
    if (!res.ok || !("entries" in res)) {
      toast(res.message || "Couldn't load time entries.", "error");
      return;
    }
    setTimesheetId(res.timesheetId);
    setStatus(res.status);
    setProjects(res.projects);
    setRate(res.rate);
    setRateType(res.rateType);
    setCurrency(res.currency);

    const grouped: Record<string, DraftEntry[]> = {};
    for (const e of res.entries) {
      grouped[e.entry_date] = grouped[e.entry_date] ?? [];
      grouped[e.entry_date]!.push(entryToDraft(e));
    }
    setEntriesByDay(grouped);
  }, [period.end, period.start, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function flashSaved() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1000);
  }

  function addEntry(date: string) {
    const dayEntries = entriesByDay[date] ?? [];
    const lastEnd = dayEntries[dayEntries.length - 1]?.end_time;
    setEntriesByDay({
      ...entriesByDay,
      [date]: [...dayEntries, newDraft(date, lastEnd || undefined)],
    });
  }

  function updateEntry(date: string, clientId: string, patch: Partial<DraftEntry>) {
    setEntriesByDay({
      ...entriesByDay,
      [date]: (entriesByDay[date] ?? []).map((e) =>
        e.clientId === clientId ? { ...e, ...patch, error: undefined } : e,
      ),
    });
  }

  async function saveEntry(entry: DraftEntry) {
    if (!editable || !timesheetId) return;
    if (!entry.start_time || !entry.end_time) return;

    const overnight = isOvernightShift(entry.start_time, entry.end_time);
    if (overnight && !entry.overnightConfirmed) {
      updateEntry(entry.entry_date, entry.clientId, {
        error: "Overnight shift — confirm to save.",
      });
      return;
    }

    updateEntry(entry.entry_date, entry.clientId, { saving: true, error: undefined });
    const res = await upsertTimeEntry({
      id: entry.id,
      timesheetId,
      entryDate: entry.entry_date,
      startTime: entry.start_time,
      endTime: entry.end_time,
      overnight: overnight || entry.overnightConfirmed,
      projectId: entry.project_id,
      description: entry.description,
      billable: entry.billable,
    });

    if (!res.ok) {
      updateEntry(entry.entry_date, entry.clientId, {
        saving: false,
        error: res.message,
      });
      return;
    }

    updateEntry(entry.entry_date, entry.clientId, {
      saving: false,
      id: res.id ?? entry.id,
      overnightConfirmed: overnight || entry.overnightConfirmed,
    });
    flashSaved();
    await load();
  }

  async function removeEntry(entry: DraftEntry) {
    if (!editable) return;
    if (entry.id) {
      const res = await deleteTimeEntry(entry.id);
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
    }
    setEntriesByDay({
      ...entriesByDay,
      [entry.entry_date]: (entriesByDay[entry.entry_date] ?? []).filter(
        (e) => e.clientId !== entry.clientId,
      ),
    });
    flashSaved();
  }

  async function handleCreateProject(name: string) {
    const res = await createProject({ name });
    if (!res.ok) {
      toast(res.message, "error");
      return null;
    }
    await load();
    return res.id ?? null;
  }

  const allEntries = useMemo(
    () => Object.values(entriesByDay).flat(),
    [entriesByDay],
  );

  const totalHours = useMemo(() => {
    return allEntries.reduce((sum, e) => {
      if (!e.start_time || !e.end_time) return sum;
      const h = hoursBetween(
        e.start_time,
        e.end_time,
        Boolean(e.overnightConfirmed) || isOvernightShift(e.start_time, e.end_time),
      );
      return sum + (h ?? 0);
    }, 0);
  }, [allEntries]);

  const billableHours = useMemo(() => {
    return allEntries.reduce((sum, e) => {
      if (!e.billable || !e.start_time || !e.end_time) return sum;
      const h = hoursBetween(
        e.start_time,
        e.end_time,
        Boolean(e.overnightConfirmed) || isOvernightShift(e.start_time, e.end_time),
      );
      return sum + (h ?? 0);
    }, 0);
  }, [allEntries]);

  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; color: string; hours: number }>();
    for (const e of allEntries) {
      if (!e.start_time || !e.end_time) continue;
      const h =
        hoursBetween(
          e.start_time,
          e.end_time,
          Boolean(e.overnightConfirmed) || isOvernightShift(e.start_time, e.end_time),
        ) ?? 0;
      const key = e.project_id ?? "none";
      const project = projects.find((p) => p.id === e.project_id);
      const cur = map.get(key) ?? {
        name: project?.name ?? "No project",
        color: project?.color ?? "#6B6F76",
        hours: 0,
      };
      cur.hours += h;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.hours - a.hours);
  }, [allEntries, projects]);

  const daysLogged = useMemo(() => {
    return new Set(allEntries.filter((e) => e.id).map((e) => e.entry_date)).size;
  }, [allEntries]);

  const workingDays = countWorkingDays(period.start, period.end);
  const showEarnings = rateType === "hourly" && rate != null;

  function shiftWeek(dir: -1 | 1) {
    const monday = mondayOfWeek(weekStart);
    const d = new Date(monday);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(toIsoDate(d));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Previous period"
              onClick={() => setPeriod((p) => shiftPeriod(p, cadence, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="font-display text-base font-medium tracking-tightest">
                {period.label}
              </p>
              <TimesheetStatusPill status={status} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Next period"
              onClick={() => setPeriod((p) => shiftPeriod(p, cadence, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <AnimatePresence>
            {savedFlash && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-[var(--accent-strong)]"
              >
                ✓ Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => shiftWeek(-1)}>
            ← Week
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => shiftWeek(1)}>
            Week →
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading entries…</p>
        ) : (
          weekDays.map((day) => (
            <div
              key={day.date}
              className={`rounded-[var(--radius)] border bg-surface p-4 ${
                day.isToday
                  ? "border-l-4 border-l-[var(--accent)]"
                  : day.isFuture
                    ? "opacity-60"
                    : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-display font-medium text-ink">
                  {day.dayName}{" "}
                  <span className="tnum text-muted">
                    {new Date(day.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </p>
                {editable && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => addEntry(day.date)}>
                    Add entry
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {(entriesByDay[day.date] ?? []).map((entry) => {
                  const liveHours =
                    entry.start_time && entry.end_time
                      ? hoursBetween(
                          entry.start_time,
                          entry.end_time,
                          Boolean(entry.overnightConfirmed) ||
                            isOvernightShift(entry.start_time, entry.end_time),
                        )
                      : null;
                  const overnight =
                    entry.start_time &&
                    entry.end_time &&
                    isOvernightShift(entry.start_time, entry.end_time);

                  return (
                    <div
                      key={entry.clientId}
                      className="grid gap-2 rounded-[var(--radius)] border border-line px-3 py-3 transition-colors hover:bg-[rgba(31,138,138,0.04)] sm:grid-cols-[auto_auto_1fr_auto]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={entry.start_time}
                          disabled={!editable}
                          onChange={(e) =>
                            updateEntry(day.date, entry.clientId, {
                              start_time: e.target.value,
                            })
                          }
                          onBlur={() => saveEntry(entry)}
                          className="h-9 rounded border bg-surface px-2 text-sm tnum"
                        />
                        <span className="text-muted">–</span>
                        <input
                          type="time"
                          value={entry.end_time}
                          disabled={!editable}
                          onChange={(e) =>
                            updateEntry(day.date, entry.clientId, { end_time: e.target.value })
                          }
                          onBlur={() => saveEntry(entry)}
                          className="h-9 rounded border bg-surface px-2 text-sm tnum"
                        />
                        <span className="tnum text-sm font-medium text-[var(--accent-strong)]">
                          {liveHours != null ? `${liveHours} hrs` : "—"}
                        </span>
                      </div>

                      <select
                        value={entry.project_id ?? ""}
                        disabled={!editable}
                        onChange={async (e) => {
                          if (e.target.value === "__new__") {
                            const name = window.prompt("Project name");
                            if (!name) return;
                            const id = await handleCreateProject(name);
                            if (id) {
                              const next = { ...entry, project_id: id };
                              updateEntry(day.date, entry.clientId, { project_id: id });
                              saveEntry(next);
                            }
                            return;
                          }
                          const next = { ...entry, project_id: e.target.value || null };
                          updateEntry(day.date, entry.clientId, {
                            project_id: e.target.value || null,
                          });
                          saveEntry(next);
                        }}
                        className="h-9 rounded border bg-surface px-2 text-sm"
                      >
                        <option value="">No project</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.is_org_wide ? "◆ " : ""}
                            {p.name}
                          </option>
                        ))}
                        {editable && <option value="__new__">+ New project</option>}
                      </select>

                      <input
                        type="text"
                        placeholder="What did you work on?"
                        value={entry.description}
                        disabled={!editable}
                        onChange={(e) =>
                          updateEntry(day.date, entry.clientId, {
                            description: e.target.value,
                          })
                        }
                        onBlur={() => saveEntry(entry)}
                        className="h-9 rounded border bg-surface px-2 text-sm"
                      />

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={entry.billable}
                            disabled={!editable}
                            onChange={(e) => {
                              const next = { ...entry, billable: e.target.checked };
                              updateEntry(day.date, entry.clientId, {
                                billable: e.target.checked,
                              });
                              saveEntry(next);
                            }}
                          />
                          Billable
                        </label>
                        {editable && (
                          <button
                            type="button"
                            aria-label="Delete entry"
                            onClick={() => removeEntry(entry)}
                            className="text-muted hover:text-[var(--danger)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {overnight && !entry.overnightConfirmed && editable && (
                        <div className="sm:col-span-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const next = { ...entry, overnightConfirmed: true };
                              updateEntry(day.date, entry.clientId, {
                                overnightConfirmed: true,
                              });
                              saveEntry(next);
                            }}
                          >
                            Confirm overnight shift (+24h)
                          </Button>
                        </div>
                      )}
                      {entry.error && (
                        <p className="text-xs text-[var(--danger)] sm:col-span-4">
                          {entry.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <aside className="flex flex-col gap-4 rounded-[var(--radius)] border bg-surface p-5 lg:sticky lg:top-6 lg:self-start">
        <h3 className="font-display text-base font-medium tracking-tightest">
          Period summary
        </h3>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Total hours</p>
          <p className="tnum text-2xl font-semibold text-ink">
            <CountUp value={totalHours} decimals={1} />
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted">By project</p>
          {byProject.length === 0 ? (
            <p className="text-sm text-muted">No entries yet.</p>
          ) : (
            byProject.map((p) => (
              <div key={p.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </span>
                  <span className="tnum">{p.hours.toFixed(1)}h</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${totalHours ? (p.hours / totalHours) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Billable</p>
            <p className="tnum font-medium">{billableHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-xs text-muted">Non-billable</p>
            <p className="tnum font-medium">{(totalHours - billableHours).toFixed(1)}h</p>
          </div>
        </div>

        {showEarnings && (
          <div>
            <p className="text-xs text-muted">Estimated earnings</p>
            <p className="tnum font-medium">
              {currency ?? "USD"} {(billableHours * (rate ?? 0)).toFixed(2)}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs text-muted">Days logged</p>
          <p className="tnum font-medium">
            {daysLogged} of {workingDays} working days
          </p>
        </div>

        {editable && (
          <Button
            className="mt-2"
            disabled={pending || allEntries.filter((e) => e.id).length === 0}
            title={
              allEntries.filter((e) => e.id).length === 0
                ? "Add at least one saved entry"
                : undefined
            }
            onClick={() =>
              startTransition(async () => {
                const res = await submitTimesheetForApproval(timesheetId);
                toast(res.message, res.ok ? "success" : "error");
                if (res.ok) await load();
              })
            }
          >
            Submit for approval
          </Button>
        )}

        <Link
          href="/app/projects"
          className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
        >
          Manage projects
        </Link>
      </aside>
    </div>
  );
}
