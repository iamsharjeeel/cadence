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
import { AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { isOvernightShift } from "@/lib/time/validation";
import {
  canPersistDecimalEntry,
  type EntryMode,
} from "@/lib/time/decimal-hours";
import {
  canPersistTimeEntry,
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
  weekDays,
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
import type { TimeTrackingData } from "@/types/time-tracking";
import {
  getTimeTrackingData,
  submitTimesheetForApproval,
} from "./time-actions";
import { createProject } from "../projects/actions";
import { LogSummarySkeleton, LogWeekSkeleton } from "./LogWeekSkeleton";
import { TimeEntryRow, type EntryRowData } from "./TimeEntryRow";
import { cn } from "@/lib/utils";

type DraftEntry = EntryRowData;

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function newDraft(date: string, lastEnd?: string): DraftEntry {
  return {
    clientId: crypto.randomUUID(),
    entry_date: date,
    entry_mode: "time_range",
    start_time: lastEnd ?? "09:00",
    end_time: lastEnd ? "" : "17:00",
    decimal_hours: "",
    project_id: null,
    description: "",
    billable: true,
    saveState: "idle",
    collapsed: false,
  };
}

function entryToDraft(e: TimeEntryWithProject): DraftEntry {
  const mode = (e.entry_mode ?? "time_range") as EntryMode;
  const start = formatTime(e.start_time);
  const end = formatTime(e.end_time);
  return {
    clientId: e.id,
    id: e.id,
    entry_date: e.entry_date,
    entry_mode: mode,
    start_time: start,
    end_time: end,
    decimal_hours:
      mode === "decimal_hours" && e.decimal_hours != null
        ? String(e.decimal_hours)
        : "",
    project_id: e.project_id,
    description: e.description ?? "",
    billable: e.billable,
    total_hours: Number(e.total_hours),
    overnightConfirmed:
      mode === "time_range" ? isOvernightShift(start, end) : false,
    saveState: "saved",
    collapsed: true,
  };
}

function entriesGrouped(entries: TimeEntryWithProject[]): Record<string, DraftEntry[]> {
  const grouped: Record<string, DraftEntry[]> = {};
  for (const e of entries) {
    grouped[e.entry_date] = grouped[e.entry_date] ?? [];
    grouped[e.entry_date]!.push(entryToDraft(e));
  }
  return grouped;
}

function applyTrackingData(
  data: TimeTrackingData,
  setters: {
    setTimesheetId: (v: string) => void;
    setOrgId: (v: string) => void;
    setEmployeeId: (v: string) => void;
    setStatus: (v: TimesheetStatus) => void;
    setProjects: (v: Project[]) => void;
    setWeek: (v: PayPeriod) => void;
    setRate: (v: number | null) => void;
    setRateType: (v: string) => void;
    setCurrency: (v: string | null) => void;
    setEntriesByDay: (v: Record<string, DraftEntry[]>) => void;
  },
) {
  setters.setTimesheetId(data.timesheetId);
  setters.setOrgId(data.orgId);
  setters.setEmployeeId(data.employeeId);
  setters.setStatus(data.status);
  setters.setProjects(data.projects);
  setters.setWeek(data.week);
  setters.setRate(data.rate);
  setters.setRateType(data.rateType);
  setters.setCurrency(data.currency);
  setters.setEntriesByDay(entriesGrouped(data.entries));
}

export function TimeTrackingView({
  initialWeekMonday,
  initialData,
}: {
  initialWeekMonday?: string;
  initialData?: TimeTrackingData | null;
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
  const [loading, setLoading] = useState(!initialData);
  const skipInitialFetch = useRef(Boolean(initialData));
  const ssrWeekMonday = initialWeekMonday ?? thisWeekMonday();

  const entriesByDayRef = useRef(entriesByDay);
  const timesheetIdRef = useRef(timesheetId);
  const orgIdRef = useRef(orgId);
  const employeeIdRef = useRef(employeeId);
  const editableRef = useRef(status === "draft" || status === "submitted" || status === "rejected");
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inFlightSaves = useRef<Map<string, Promise<void>>>(new Map());

  entriesByDayRef.current = entriesByDay;
  timesheetIdRef.current = timesheetId;
  orgIdRef.current = orgId;
  employeeIdRef.current = employeeId;
  editableRef.current = status === "draft" || status === "submitted" || status === "rejected";

  const editable = status === "draft" || status === "submitted" || status === "rejected";
  const days = useMemo(() => weekDays(weekMonday), [weekMonday]);
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
    applyTrackingData(res, {
      setTimesheetId,
      setOrgId,
      setEmployeeId,
      setStatus,
      setProjects,
      setWeek,
      setRate,
      setRateType,
      setCurrency,
      setEntriesByDay,
    });
  }, [weekMonday, toast]);

  useEffect(() => {
    if (
      skipInitialFetch.current &&
      initialData &&
      weekMonday === ssrWeekMonday
    ) {
      skipInitialFetch.current = false;
      applyTrackingData(initialData, {
        setTimesheetId,
        setOrgId,
        setEmployeeId,
        setStatus,
        setProjects,
        setWeek,
        setRate,
        setRateType,
        setCurrency,
        setEntriesByDay,
      });
      setLoading(false);
      return;
    }
    load();
  }, [load, weekMonday, initialData, ssrWeekMonday]);

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
      const existing = inFlightSaves.current.get(clientId);
      if (existing) {
        await existing;
        return;
      }

      const run = async () => {
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

        const isDecimal = entry.entry_mode === "decimal_hours";
        if (
          isDecimal
            ? !canPersistDecimalEntry(entry.decimal_hours)
            : !canPersistTimeEntry(entry.start_time, entry.end_time)
        ) {
          return;
        }

        const overnight =
          !isDecimal && isOvernightShift(entry.start_time, entry.end_time);
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
          entryMode: entry.entry_mode,
          startTime: entry.start_time,
          endTime: entry.end_time,
          decimalHours: entry.decimal_hours,
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
          collapsed: true,
        });

        window.setTimeout(() => {
          const cur = getEntry(date, clientId);
          if (cur?.saveState === "saved") {
            updateEntry(date, clientId, { saveState: "idle" });
          }
        }, 1600);
      };

      const promise = run().finally(() => {
        inFlightSaves.current.delete(clientId);
      });
      inFlightSaves.current.set(clientId, promise);
      await promise;
    },
    [],
  );

  const scheduleSave = useCallback(
    (date: string, clientId: string, overrides?: Partial<DraftEntry>) => {
      const entry = getEntry(date, clientId);
      if (!entry) return;
      const merged = { ...entry, ...overrides };
      const persistable =
        merged.entry_mode === "decimal_hours"
          ? canPersistDecimalEntry(merged.decimal_hours)
          : canPersistTimeEntry(merged.start_time, merged.end_time);
      if (!persistable) return;

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
    const timer = debounceTimers.current.get(entry.clientId);
    if (timer) clearTimeout(timer);
    inFlightSaves.current.delete(entry.clientId);

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

  async function handleCreateProject(name: string, color?: string) {
    const res = await createProject({ name, color });
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
          <LogWeekSkeleton />
        ) : (
          days.map((day) => (
            <div
              key={day.date}
              className={cn(
                "rounded-[var(--radius)] border border-[var(--line)] bg-surface p-5 shadow-sm",
                day.isToday && "border-l-4 border-l-[var(--accent)]",
                day.isFuture && !day.isWeekend && "opacity-80",
                day.isWeekend && "border-dashed bg-[var(--bg)]/60",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p
                    className={cn(
                      "font-display text-base font-medium tracking-tightest",
                      day.isWeekend ? "text-muted" : "text-ink",
                    )}
                  >
                    {day.dayName}
                  </p>
                  <p className="tnum text-sm text-muted">
                    {new Date(day.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                    {day.isWeekend && (
                      <span className="ml-2 text-xs">Weekend · optional</span>
                    )}
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
                  {(entriesByDay[day.date] ?? []).map((entry) => (
                    <TimeEntryRow
                      key={entry.clientId}
                      entry={entry}
                      editable={editable}
                      projects={projects}
                      onPatch={(patch) =>
                        updateEntry(day.date, entry.clientId, patch)
                      }
                      onBlurField={(field, value) => {
                        if (
                          field === "start_time" ||
                          field === "end_time" ||
                          field === "description"
                        ) {
                          scheduleSave(day.date, entry.clientId, {
                            [field]: value,
                          });
                        }
                      }}
                      onSave={() => persistEntry(day.date, entry.clientId)}
                      onDelete={() => removeEntry(entry)}
                      onBillableChange={(next) => {
                        updateEntry(day.date, entry.clientId, {
                          billable: next,
                          saveState: "idle",
                        });
                        const cur = getEntry(day.date, entry.clientId);
                        if (
                          cur &&
                          canPersistTimeEntry(cur.start_time, cur.end_time)
                        ) {
                          void persistEntry(day.date, entry.clientId, {
                            billable: next,
                          });
                        }
                      }}
                      onConfirmOvernight={() => {
                        updateEntry(day.date, entry.clientId, {
                          overnightConfirmed: true,
                        });
                        void persistEntry(day.date, entry.clientId, {
                          overnightConfirmed: true,
                        });
                      }}
                      onProjectChange={(projectId) => {
                        updateEntry(day.date, entry.clientId, {
                          project_id: projectId,
                          saveState: "idle",
                        });
                        const cur = getEntry(day.date, entry.clientId);
                        if (
                          cur &&
                          canPersistTimeEntry(cur.start_time, cur.end_time)
                        ) {
                          void persistEntry(day.date, entry.clientId, {
                            project_id: projectId,
                          });
                        }
                      }}
                      onCreateProject={handleCreateProject}
                      onExpand={() =>
                        updateEntry(day.date, entry.clientId, { collapsed: false })
                      }
                    />
                  ))}
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
        {loading ? (
          <LogSummarySkeleton />
        ) : (
          <>
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
                  <div
                    key={p.projectId ?? p.name}
                    className="flex flex-col gap-1.5"
                  >
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
          </>
        )}
      </aside>
    </div>
  );
}
