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
import { Check, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { fieldBase } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { cn } from "@/lib/utils";
import { hoursBetween, isOvernightShift } from "@/lib/time/validation";
import {
  deleteTimeEntryClient,
  saveTimeEntryClient,
} from "@/lib/time/time-entry-client";
import {
  computeWeekStatsFromPersisted,
  groupHoursByProject,
} from "@/lib/time/week-stats-client";
import {
  isoWeekLabel,
  shiftWeekMonday,
  thisWeekMonday,
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
  getTimeTrackingData,
  submitTimesheetForApproval,
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
  total_hours?: number | null;
  overnightConfirmed?: boolean;
  saveState: SaveState;
  error?: string;
};

const ROW_MOTION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

const timeFieldClass = cn(
  fieldBase,
  "h-9 w-[5.5rem] shrink-0 px-2.5 text-sm tnum",
);

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
    total_hours: Number(e.total_hours),
    overnightConfirmed: isOvernightShift(
      formatTime(e.start_time),
      formatTime(e.end_time),
    ),
    saveState: "saved",
  };
}

function BillableToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
        checked
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "bg-[var(--line)] text-muted",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      Billable
    </button>
  );
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
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]"
      >
        <Check className="h-3 w-3" aria-hidden />
        Saved
      </motion.span>
    );
  }
  if (state === "error") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{error ?? "Couldn't save"}</span>
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
  const [orgId, setOrgId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<TimesheetStatus>("draft");
  const [projects, setProjects] = useState<Project[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, DraftEntry[]>>(
    {},
  );
  const [rate, setRate] = useState<number | null>(null);
  const [rateType, setRateType] = useState("hourly");
  const [currency, setCurrency] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const entriesByDayRef = useRef(entriesByDay);
  const timesheetIdRef = useRef(timesheetId);
  const orgIdRef = useRef(orgId);
  const employeeIdRef = useRef(employeeId);
  const editableRef = useRef(status === "draft" || status === "rejected");
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  entriesByDayRef.current = entriesByDay;
  timesheetIdRef.current = timesheetId;
  orgIdRef.current = orgId;
  employeeIdRef.current = employeeId;
  editableRef.current = status === "draft" || status === "rejected";

  const editable = status === "draft" || status === "rejected";
  const workDays = useMemo(() => workingWeekDays(weekMonday), [weekMonday]);
  const isoWeek = useMemo(() => isoWeekLabel(weekMonday), [weekMonday]);
  const isCurrentWeek = weekMonday === thisWeekMonday();

  const allEntries = useMemo(
    () => Object.values(entriesByDay).flat(),
    [entriesByDay],
  );

  const weekStats: WeekStats = useMemo(
    () => computeWeekStatsFromPersisted(allEntries),
    [allEntries],
  );

  const byProject = useMemo(
    () => groupHoursByProject(allEntries, projects),
    [allEntries, projects],
  );

  const billableHours = useMemo(
    () => byProject.reduce((sum, p) => sum + p.billableHours, 0),
    [byProject],
  );

  const totalHours = weekStats.totalHours;
  const showEarnings = rateType === "hourly" && rate != null;
  const showOvertimeNotice = totalHours > OVERTIME_HOURS_THRESHOLD;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getTimeTrackingData(weekMonday);
    setLoading(false);
    if (!res.ok || !("entries" in res)) {
      toast(res.message || "Couldn't load time entries.", "error");
      return;
    }
    setTimesheetId(res.timesheetId);
    setOrgId(res.orgId);
    setEmployeeId(res.employeeId);
    setStatus(res.status);
    setProjects(res.projects);
    setWeek(res.week);
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
    const timers = debounceTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
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
      const org = orgIdRef.current;
      const empId = employeeIdRef.current;

      if (!editableRef.current) return;
      if (!tsId || !org || !empId) {
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

      const res = await saveTimeEntryClient({
        id: entry.id,
        orgId: org,
        employeeId: empId,
        timesheetId: tsId,
        entryDate: entry.entry_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
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
        id: res.id,
        total_hours: res.total_hours,
        project_id: entry.project_id,
        description: entry.description,
        billable: entry.billable,
        overnightConfirmed: overnight || entry.overnightConfirmed,
      });

      window.setTimeout(() => {
        const cur = getEntry(date, clientId);
        if (cur?.saveState === "saved") {
          updateEntry(date, clientId, { saveState: "idle" });
        }
      }, 1600);
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
      const res = await deleteTimeEntryClient(entry.id, employeeIdRef.current);
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg font-medium tracking-tightest text-ink">
              {week?.label ?? "…"}
            </p>
            <p className="tnum text-sm text-muted">{isoWeek}</p>
            <div className="mt-1">
              <TimesheetStatusPill status={status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
              className={cn(
                "rounded-[var(--radius)] border border-[var(--line)] bg-surface p-5 shadow-sm",
                day.isToday && "border-l-4 border-l-[var(--accent)]",
                day.isFuture && "opacity-70",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base font-medium tracking-tightest text-ink">
                    {day.dayName}
                  </p>
                  <p className="tnum text-sm text-muted">
                    {new Date(day.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                {editable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => addEntry(day.date)}
                  >
                    Add entry
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {(entriesByDay[day.date] ?? []).map((entry) => {
                    const overnight =
                      entry.start_time &&
                      entry.end_time &&
                      isOvernightShift(entry.start_time, entry.end_time);
                    const previewHours =
                      entry.start_time && entry.end_time
                        ? hoursBetween(
                            entry.start_time,
                            entry.end_time,
                            Boolean(entry.overnightConfirmed) || Boolean(overnight),
                          )
                        : null;
                    const displayHours =
                      entry.id && entry.total_hours != null
                        ? entry.total_hours
                        : previewHours;
                    const selectedProject = projects.find(
                      (p) => p.id === entry.project_id,
                    );

                    return (
                      <motion.div
                        key={entry.clientId}
                        layout
                        {...ROW_MOTION}
                        className="overflow-hidden"
                      >
                        <div
                          className={cn(
                            "flex flex-col gap-3 rounded-[calc(var(--radius)-4px)]",
                            "border border-[var(--line)] bg-[var(--bg)]/40 p-3",
                            "lg:grid lg:grid-cols-[auto_auto_minmax(10rem,1fr)_minmax(8rem,2fr)_auto] lg:items-center lg:gap-3",
                          )}
                        >
                          <div className="flex items-center gap-1.5">
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
                              className={timeFieldClass}
                              aria-label="Start time"
                            />
                            <span className="text-sm text-muted" aria-hidden>
                              –
                            </span>
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
                              className={timeFieldClass}
                              aria-label="End time"
                            />
                          </div>

                          <span
                            className={cn(
                              "tnum inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium",
                              "bg-[var(--line)] text-muted",
                            )}
                          >
                            {displayHours != null
                              ? `${displayHours.toFixed(1)}h`
                              : "—"}
                          </span>

                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  selectedProject?.color ?? "transparent",
                              }}
                              aria-hidden
                            />
                            <select
                              value={entry.project_id ?? ""}
                              disabled={!editable}
                              onChange={async (e) => {
                                if (e.target.value === "__new__") {
                                  const name = window.prompt("Project name");
                                  if (!name) return;
                                  const id = await handleCreateProject(name);
                                  if (id) {
                                    updateEntry(day.date, entry.clientId, {
                                      project_id: id,
                                    });
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
                              className={cn(
                                fieldBase,
                                "h-9 min-w-0 flex-1 py-0 text-sm",
                              )}
                            >
                              <option value="">No project</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.is_org_wide ? "[Org] " : ""}
                                  {p.name}
                                </option>
                              ))}
                              {editable && (
                                <option value="__new__">+ New project</option>
                              )}
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
                            className={cn(fieldBase, "h-9 min-w-0 text-sm")}
                          />

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <BillableToggle
                              checked={entry.billable}
                              disabled={!editable}
                              onChange={(next) => {
                                updateEntry(day.date, entry.clientId, {
                                  billable: next,
                                  saveState: "idle",
                                });
                                void persistEntry(day.date, entry.clientId, {
                                  billable: next,
                                });
                              }}
                            />
                            {editable && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    persistEntry(day.date, entry.clientId)
                                  }
                                >
                                  Save
                                </Button>
                                <button
                                  type="button"
                                  aria-label="Delete entry"
                                  onClick={() => removeEntry(entry)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--line)] hover:text-[var(--danger)]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <AnimatePresence mode="wait">
                              {(entry.saveState !== "idle" ||
                                entry.error) && (
                                <EntrySaveIndicator
                                  state={entry.saveState}
                                  error={entry.error}
                                  onRetry={() =>
                                    persistEntry(day.date, entry.clientId)
                                  }
                                />
                              )}
                            </AnimatePresence>
                          </div>

                          {overnight && !entry.overnightConfirmed && editable && (
                            <div className="lg:col-span-full">
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
                                Confirm overnight shift
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {(entriesByDay[day.date] ?? []).length === 0 && (
                  <p className="text-sm text-muted">No entries for this day.</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <aside className="flex flex-col gap-5 rounded-[var(--radius)] border border-[var(--line)] bg-surface p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
        <h3 className="font-display text-base font-medium tracking-tightest text-ink">
          Week summary
        </h3>

        <div className="border-b border-[var(--line)] pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Total hours
          </p>
          <p className="tnum mt-1 text-3xl font-semibold text-ink">
            <CountUp value={totalHours} decimals={1} />
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            By project
          </p>
          {byProject.length === 0 ? (
            <p className="text-sm text-muted">No entries yet.</p>
          ) : (
            byProject.map((p) => (
              <div key={p.projectId ?? p.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-ink">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="tnum shrink-0 font-medium">
                    {p.hours.toFixed(1)}h
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                    style={{
                      width: `${totalHours ? (p.hours / totalHours) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4 text-sm">
          <div>
            <p className="text-xs text-muted">Billable</p>
            <p className="tnum mt-0.5 font-medium text-ink">
              {billableHours.toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Non-billable</p>
            <p className="tnum mt-0.5 font-medium text-ink">
              {(totalHours - billableHours).toFixed(1)}h
            </p>
          </div>
        </div>

        {showEarnings && (
          <div className="border-t border-[var(--line)] pt-4">
            <p className="text-xs text-muted">Estimated earnings</p>
            <p className="tnum mt-0.5 font-medium text-ink">
              {currency ?? "USD"}{" "}
              {(totalHours * (rate ?? 0)).toFixed(2)}
            </p>
          </div>
        )}

        <div className="border-t border-[var(--line)] pt-4">
          <p className="text-xs text-muted">Submit progress</p>
          <p className="tnum mt-0.5 text-sm font-medium text-ink">
            {weekStats.daysLogged} / {SUBMIT_MIN_DAYS} days ·{" "}
            {weekStats.totalHours.toFixed(1)} / {SUBMIT_MIN_HOURS}.0h
          </p>
        </div>

        {showOvertimeNotice && editable && (
          <p className="rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-strong)]">
            <span className="tnum font-medium">
              {(totalHours - OVERTIME_HOURS_THRESHOLD).toFixed(1)}h
            </span>{" "}
            overtime — your manager will approve the extra time.
          </p>
        )}

        {editable && (
          <Button
            className="w-full"
            disabled={pending || !timesheetId || !weekStats.canSubmit}
            title={
              !weekStats.canSubmit
                ? `Log at least ${SUBMIT_MIN_DAYS} days or ${SUBMIT_MIN_HOURS} hours`
                : undefined
            }
            onClick={() => {
              const tsId = timesheetIdRef.current;
              if (!tsId) {
                toast(
                  "Still loading your timesheet — try again in a moment.",
                  "error",
                );
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
          className="text-center text-sm font-medium text-[var(--accent-strong)] hover:underline"
        >
          Manage projects
        </Link>
      </aside>
    </div>
  );
}
