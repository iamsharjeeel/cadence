"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { hoursBetween, isOvernightShift } from "@/lib/time/validation";
import {
  isoWeekLabel,
  shiftWeekMonday,
  thisWeekMonday,
  toIsoDate,
  workingWeekDays,
  type PayPeriod,
} from "@/lib/time/periods";
import {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";
import type { TimesheetStatus } from "@/types/db";
import type { Project, TimeEntryWithProject } from "@/types/time-tracking";
import {
  deleteTimeEntry,
  getTimeTrackingData,
  submitTimesheetForApproval,
  upsertTimeEntry,
} from "./time-actions";
import { createProject } from "../projects/actions";

type SaveState = "idle" | "saving" | "saved" | "error";

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
  saveState: SaveState;
  error?: string;
};

function formatTime(value: string): string {
  return value.slice(0, 5);
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
    saveState: "idle",
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
    saveState: "saved",
  };
}

function EntrySaveIndicator({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error?: string;
  onRetry?: () => void;
}) {
  if (state === "saving") {
    return <span className="text-xs text-muted">Saving…</span>;
  }
  if (state === "saved") {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-xs font-medium text-[var(--accent-strong)]"
      >
        Saved
      </motion.span>
    );
  }
  if (state === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--danger)]">{error ?? "Couldn't save"}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  return null;
}

export function TimeTrackingView({
  initialWeekMonday,
}: {
  initialWeekMonday?: string;
}) {
  const { toast } = useToast();
  const [weekMonday, setWeekMonday] = useState(
    initialWeekMonday ?? thisWeekMonday(),
  );
  const [week, setWeek] = useState<PayPeriod | null>(null);
  const [timesheetId, setTimesheetId] = useState("");
  const [status, setStatus] = useState<TimesheetStatus>("draft");
  const [projects, setProjects] = useState<Project[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, DraftEntry[]>>({});
  const [weekStats, setWeekStats] = useState<WeekStats>({
    daysLogged: 0,
    totalHours: 0,
    canSubmit: false,
    overtimeHours: 0,
  });
  const [rate, setRate] = useState<number | null>(null);
  const [rateType, setRateType] = useState("hourly");
  const [currency, setCurrency] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const entriesByDayRef = useRef(entriesByDay);
  const timesheetIdRef = useRef(timesheetId);
  const editableRef = useRef(status === "draft" || status === "rejected");
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  entriesByDayRef.current = entriesByDay;
  timesheetIdRef.current = timesheetId;
  editableRef.current = status === "draft" || status === "rejected";

  const editable = status === "draft" || status === "rejected";
  const workDays = useMemo(() => workingWeekDays(weekMonday), [weekMonday]);
  const isoWeek = useMemo(() => isoWeekLabel(weekMonday), [weekMonday]);
  const isCurrentWeek = weekMonday === thisWeekMonday();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getTimeTrackingData(weekMonday);
    setLoading(false);
    if (!res.ok || !("entries" in res)) {
      toast(res.message || "Couldn't load time entries.", "error");
      return;
    }
    setTimesheetId(res.timesheetId);
    setStatus(res.status);
    setProjects(res.projects);
    setWeek(res.week);
    setWeekStats(res.weekStats);
    setRate(res.rate);
    setRateType(res.rateType);
    setCurrency(res.currency);

    const grouped: Record<string, DraftEntry[]> = {};
    for (const e of res.entries) {
      grouped[e.entry_date] = grouped[e.entry_date] ?? [];
      grouped[e.entry_date]!.push(entryToDraft(e));
    }
    setEntriesByDay(grouped);
  }, [weekMonday, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      for (const t of debounceTimers.current.values()) clearTimeout(t);
    };
  }, []);

  function updateEntry(date: string, clientId: string, patch: Partial<DraftEntry>) {
    setEntriesByDay((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).map((e) =>
        e.clientId === clientId ? { ...e, ...patch } : e,
      ),
    }));
  }

  function getEntry(date: string, clientId: string): DraftEntry | undefined {
    return entriesByDayRef.current[date]?.find((e) => e.clientId === clientId);
  }

  const persistEntry = useCallback(
    async (date: string, clientId: string, overrides?: Partial<DraftEntry>) => {
      const base = getEntry(date, clientId);
      if (!base) return;

      const entry = { ...base, ...overrides };
      const tsId = timesheetIdRef.current;

      if (!editableRef.current) return;
      if (!tsId) {
        updateEntry(date, clientId, {
          saveState: "error",
          error: "Timesheet not ready.",
        });
        return;
      }
      if (!entry.start_time || !entry.end_time) return;

      const overnight = isOvernightShift(entry.start_time, entry.end_time);
      if (overnight && !entry.overnightConfirmed) {
        updateEntry(date, clientId, {
          saveState: "error",
          error: "Overnight shift — confirm to save.",
        });
        return;
      }

      updateEntry(date, clientId, { saveState: "saving", error: undefined });
      const res = await upsertTimeEntry({
        id: entry.id,
        timesheetId: tsId,
        entryDate: entry.entry_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
        overnight: overnight || entry.overnightConfirmed,
        projectId: entry.project_id,
        description: entry.description,
        billable: entry.billable,
      });

      if (!res.ok) {
        updateEntry(date, clientId, {
          saveState: "error",
          error: res.message,
        });
        return;
      }

      updateEntry(date, clientId, {
        saveState: "saved",
        id: res.id ?? entry.id,
        project_id: entry.project_id,
        description: entry.description,
        billable: entry.billable,
        overnightConfirmed: overnight || entry.overnightConfirmed,
      });
      if (res.weekStats) setWeekStats(res.weekStats);

      window.setTimeout(() => {
        const cur = getEntry(date, clientId);
        if (cur?.saveState === "saved") {
          updateEntry(date, clientId, { saveState: "idle" });
        }
      }, 1500);
    },
    [],
  );

  const scheduleSave = useCallback(
    (date: string, clientId: string, overrides?: Partial<DraftEntry>) => {
      const key = clientId;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          void persistEntry(date, clientId, overrides);
        }, 600),
      );
    },
    [persistEntry],
  );

  function addEntry(date: string) {
    const dayEntries = entriesByDay[date] ?? [];
    const lastEnd = dayEntries[dayEntries.length - 1]?.end_time;
    setEntriesByDay((prev) => ({
      ...prev,
      [date]: [...(prev[date] ?? []), newDraft(date, lastEnd || undefined)],
    }));
  }

  async function removeEntry(entry: DraftEntry) {
    if (!editable) return;
    if (entry.id) {
      const res = await deleteTimeEntry(entry.id);
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      if (res.weekStats) setWeekStats(res.weekStats);
    }
    setEntriesByDay((prev) => ({
      ...prev,
      [entry.entry_date]: (prev[entry.entry_date] ?? []).filter(
        (e) => e.clientId !== entry.clientId,
      ),
    }));
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

  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; color: string; hours: number }>();
    for (const e of allEntries) {
      if (!e.id || !e.start_time || !e.end_time) continue;
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

  const billableHours = useMemo(() => {
    return allEntries.reduce((sum, e) => {
      if (!e.billable || !e.id || !e.start_time || !e.end_time) return sum;
      const h = hoursBetween(
        e.start_time,
        e.end_time,
        Boolean(e.overnightConfirmed) || isOvernightShift(e.start_time, e.end_time),
      );
      return sum + (h ?? 0);
    }, 0);
  }, [allEntries]);

  const showEarnings = rateType === "hourly" && rate != null;
  const totalHours = weekStats.totalHours;
  const showOvertimeNotice = totalHours > OVERTIME_HOURS_THRESHOLD;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-base font-medium tracking-tightest">
              {week?.label ?? "…"}
            </p>
            <p className="tnum text-sm text-muted">{isoWeek}</p>
            <TimesheetStatusPill status={status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setWeekMonday((m) => shiftWeekMonday(m, -1))}
            >
              ← Prev week
            </Button>
            <Button
              type="button"
              variant={isCurrentWeek ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setWeekMonday(thisWeekMonday())}
            >
              This week
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setWeekMonday((m) => shiftWeekMonday(m, 1))}
            >
              Next week →
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading entries…</p>
        ) : (
          workDays.map((day) => (
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
                              saveState: "idle",
                            })
                          }
                          onBlur={(e) =>
                            scheduleSave(day.date, entry.clientId, {
                              start_time: e.target.value,
                            })
                          }
                          className="h-9 rounded border bg-surface px-2 text-sm tnum"
                        />
                        <span className="text-muted">–</span>
                        <input
                          type="time"
                          value={entry.end_time}
                          disabled={!editable}
                          onChange={(e) =>
                            updateEntry(day.date, entry.clientId, {
                              end_time: e.target.value,
                              saveState: "idle",
                            })
                          }
                          onBlur={(e) =>
                            scheduleSave(day.date, entry.clientId, {
                              end_time: e.target.value,
                            })
                          }
                          className="h-9 rounded border bg-surface px-2 text-sm tnum"
                        />
                        <span className="tnum text-sm font-medium text-[var(--accent-strong)]">
                          {liveHours != null ? `${liveHours} hrs` : "—"}
                        </span>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        {entry.project_id && (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                projects.find((p) => p.id === entry.project_id)?.color ??
                                "#6B6F76",
                            }}
                            aria-hidden
                          />
                        )}
                        <select
                          value={entry.project_id ?? ""}
                          disabled={!editable}
                          onChange={async (e) => {
                            if (e.target.value === "__new__") {
                              const name = window.prompt("Project name");
                              if (!name) return;
                              const id = await handleCreateProject(name);
                              if (id) {
                                updateEntry(day.date, entry.clientId, { project_id: id });
                                await persistEntry(day.date, entry.clientId, {
                                  project_id: id,
                                });
                              }
                              return;
                            }
                            const projectId =
                              e.target.value === "" ? null : e.target.value;
                            updateEntry(day.date, entry.clientId, {
                              project_id: projectId,
                              saveState: "idle",
                            });
                            await persistEntry(day.date, entry.clientId, {
                              project_id: projectId,
                            });
                          }}
                          className="h-9 min-w-0 flex-1 rounded border bg-surface px-2 text-sm"
                        >
                          <option value="">No project</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.is_org_wide ? "[Org] " : ""}
                              {p.name}
                            </option>
                          ))}
                          {editable && <option value="__new__">+ New project</option>}
                        </select>
                      </div>

                      <input
                        type="text"
                        placeholder="What did you work on?"
                        value={entry.description}
                        disabled={!editable}
                        onChange={(e) =>
                          updateEntry(day.date, entry.clientId, {
                            description: e.target.value,
                            saveState: "idle",
                          })
                        }
                        onBlur={(e) =>
                          scheduleSave(day.date, entry.clientId, {
                            description: e.target.value,
                          })
                        }
                        className="h-9 rounded border bg-surface px-2 text-sm"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={entry.billable}
                            disabled={!editable}
                            onChange={(e) => {
                              updateEntry(day.date, entry.clientId, {
                                billable: e.target.checked,
                                saveState: "idle",
                              });
                              void persistEntry(day.date, entry.clientId, {
                                billable: e.target.checked,
                              });
                            }}
                          />
                          Billable
                        </label>
                        {editable && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => persistEntry(day.date, entry.clientId)}
                            >
                              Save
                            </Button>
                            <button
                              type="button"
                              aria-label="Delete entry"
                              onClick={() => removeEntry(entry)}
                              className="text-muted hover:text-[var(--danger)]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <AnimatePresence mode="wait">
                          <EntrySaveIndicator
                            state={entry.saveState}
                            error={entry.error}
                            onRetry={() => persistEntry(day.date, entry.clientId)}
                          />
                        </AnimatePresence>
                      </div>

                      {overnight && !entry.overnightConfirmed && editable && (
                        <div className="sm:col-span-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              updateEntry(day.date, entry.clientId, {
                                overnightConfirmed: true,
                              });
                              void persistEntry(day.date, entry.clientId, {
                                overnightConfirmed: true,
                              });
                            }}
                          >
                            Confirm overnight shift (+24h)
                          </Button>
                        </div>
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
          Week summary
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
            <p className="tnum font-medium">
              {(totalHours - billableHours).toFixed(1)}h
            </p>
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
          <p className="text-xs text-muted">Submit progress</p>
          <p className="tnum text-sm font-medium">
            {weekStats.daysLogged} / {SUBMIT_MIN_DAYS} days ·{" "}
            {weekStats.totalHours.toFixed(1)} / {SUBMIT_MIN_HOURS}.0h
          </p>
        </div>

        {showOvertimeNotice && editable && (
          <p className="rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-strong)]">
            <span className="tnum font-medium">
              {(totalHours - OVERTIME_HOURS_THRESHOLD).toFixed(1)}h
            </span>{" "}
            overtime — your manager will approve the extra time.
          </p>
        )}

        {editable && (
          <Button
            className="mt-2"
            disabled={pending || !timesheetId || !weekStats.canSubmit}
            title={
              !weekStats.canSubmit
                ? `Log at least ${SUBMIT_MIN_DAYS} days or ${SUBMIT_MIN_HOURS} hours`
                : undefined
            }
            onClick={() => {
              const tsId = timesheetIdRef.current;
              if (!tsId) {
                toast("Still loading your timesheet — try again in a moment.", "error");
                return;
              }
              startTransition(async () => {
                const res = await submitTimesheetForApproval(tsId);
                toast(res.message, res.ok ? "success" : "error");
                if (res.ok) await load();
              });
            }}
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
