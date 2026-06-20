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
import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import {
  formatGoogleEventTimeRange,
  googleEventToDraftTimes,
  type GoogleCalendarPrefill,
} from "@/lib/google-calendar/prefill";
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
import {
  canPersistDecimalEntry,
  type EntryMode,
} from "@/lib/time/decimal-hours";
import {
  canPersistTimeEntry,
  deleteTimeEntryClient,
  saveTimeEntryClient,
} from "@/lib/time/time-entry-client";
import { durationHours } from "@/lib/time/validation";
import {
  computeWeekStatsFromPersisted,
  groupHoursByProject,
} from "@/lib/time/week-stats-client";
import {
  addDays,
  dayName,
  datesInRange,
  isoWeekLabel,
  toIsoDate,
  type PayPeriod,
} from "@/lib/time/periods";
import {
  OVERTIME_HOURS_THRESHOLD,
  type WeekStats,
} from "@/lib/time/week-constants";
import type { TimesheetStatus } from "@/types/db";
import type { AsanaImportedProject } from "@/types/db";
import type { Project, TimeEntryWithProject } from "@/types/time-tracking";
import type { TimeTrackingData } from "@/types/time-tracking";
import {
  copyTimeEntryToDays,
  getTimeTrackingData,
  requestTimesheetEdit,
  submitTimesheetForApproval,
} from "./time-actions";
import { createProject } from "../projects/actions";
import { syncImportedAsanaProjectNames } from "../profile/asana-actions";
import { LogSummarySkeleton, LogWeekSkeleton } from "./LogWeekSkeleton";
import { TimeEntryRow, type EntryRowData } from "./TimeEntryRow";
import { cn } from "@/lib/utils";
import { MotionModal } from "@/components/motion/MotionModal";
import { computeTimesheetLifecycle, periodLengthDays } from "@/lib/timesheets/lifecycle";

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
    asana_project_id: null,
    description: "",
    billable: true,
    billableTouched: false,
    saveState: "idle",
    collapsed: false,
  };
}

function entryToDraft(e: TimeEntryWithProject): DraftEntry {
  const mode = (e.entry_mode ?? "time_range") as EntryMode;
  const start = formatTime(e.start_time);
  const end = formatTime(e.end_time);
  // Never trust the DB `total_hours` (generated, negative for overnight) —
  // recompute with overnight wrapping for display/aggregation.
  const computedHours =
    mode === "decimal_hours" && e.decimal_hours != null
      ? Number(e.decimal_hours)
      : durationHours(start, end) ?? Number(e.total_hours);
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
    asana_project_id: e.asana_project_id ?? null,
    description: e.description ?? "",
    billable: e.billable,
    billableTouched: true,
    total_hours: computedHours,
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
    setAsanaConnected: (v: boolean) => void;
    setAsanaImportedProjects: (v: AsanaImportedProject[]) => void;
    setAsanaProjectNamesSyncedAt: (v: string | null) => void;
    setWeek: (v: PayPeriod) => void;
    setRate: (v: number | null) => void;
    setRateType: (v: string) => void;
    setCurrency: (v: string | null) => void;
    setSubmittedAt: (v: string | null) => void;
    setEditRequestStatus: (v: "pending" | "approved" | "rejected" | null) => void;
    setEditRequestNote: (v: string | null) => void;
    setEntriesByDay: (v: Record<string, DraftEntry[]>) => void;
  },
) {
  setters.setTimesheetId(data.timesheetId);
  setters.setOrgId(data.orgId ?? "");
  setters.setEmployeeId(data.employeeId);
  setters.setStatus(data.status);
  setters.setProjects(data.projects);
  setters.setAsanaConnected(data.asanaConnected);
  setters.setAsanaImportedProjects(data.asanaImportedProjects);
  setters.setAsanaProjectNamesSyncedAt(data.asanaProjectNamesSyncedAt);
  setters.setWeek(data.week);
  setters.setRate(data.rate);
  setters.setRateType(data.rateType);
  setters.setCurrency(data.currency);
  setters.setSubmittedAt(data.submittedAt);
  setters.setEditRequestStatus(data.editRequestStatus);
  setters.setEditRequestNote(data.editRequestNote);
  setters.setEntriesByDay(entriesGrouped(data.entries));
}

export function TimeTrackingView({
  initialWeekMonday,
  initialData,
  calendarEventsByDay = {},
  initialPrefill = null,
  initialFocusDate = null,
}: {
  initialWeekMonday?: string;
  initialData?: TimeTrackingData | null;
  calendarEventsByDay?: Record<string, GoogleCalendarEventWithMeta[]>;
  initialPrefill?: GoogleCalendarPrefill | null;
  initialFocusDate?: string | null;
}) {
  const { toast } = useToast();
  const [weekMonday, setWeekMonday] = useState(
    initialWeekMonday ?? toIsoDate(new Date()),
  );
  const [week, setWeek] = useState<PayPeriod | null>(null);
  const [timesheetId, setTimesheetId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<TimesheetStatus>("draft");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [editRequestStatus, setEditRequestStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  const [editRequestNote, setEditRequestNote] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [asanaConnected, setAsanaConnected] = useState(false);
  const [asanaImportedProjects, setAsanaImportedProjects] = useState<
    AsanaImportedProject[]
  >([]);
  const [asanaProjectNamesSyncedAt, setAsanaProjectNamesSyncedAt] = useState<
    string | null
  >(null);
  const [asanaSyncPending, setAsanaSyncPending] = useState(false);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, DraftEntry[]>>(
    {},
  );
  const [rate, setRate] = useState<number | null>(null);
  const [rateType, setRateType] = useState("hourly");
  const [currency, setCurrency] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!initialData);
  const [personalLengthDays, setPersonalLengthDays] = useState<7 | 15 | 30>(7);
  const [requestEditOpen, setRequestEditOpen] = useState(false);
  const [requestEditNote, setRequestEditNote] = useState("");
  const [requestEditPending, setRequestEditPending] = useState(false);
  const [copySource, setCopySource] = useState<DraftEntry | null>(null);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyPending, setCopyPending] = useState(false);
  const skipInitialFetch = useRef(Boolean(initialData));
  const prefillApplied = useRef(false);
  const ssrWeekMonday = initialWeekMonday ?? toIsoDate(new Date());

  const loadSeq = useRef(0);
  const entriesByDayRef = useRef(entriesByDay);
  const timesheetIdRef = useRef(timesheetId);
  const orgIdRef = useRef(orgId);
  const employeeIdRef = useRef(employeeId);
  const lifecycle = useMemo(
    () =>
      computeTimesheetLifecycle({
        status,
        periodEnd: week?.end ?? addDays(weekMonday, 6),
        submittedAt,
        editRequestStatus,
      }),
    [status, submittedAt, week, weekMonday, editRequestStatus],
  );
  const editableRef = useRef(lifecycle.canEditEntries);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inFlightSaves = useRef<Map<string, Promise<void>>>(new Map());

  entriesByDayRef.current = entriesByDay;
  timesheetIdRef.current = timesheetId;
  orgIdRef.current = orgId;
  employeeIdRef.current = employeeId;
  editableRef.current = lifecycle.canEditEntries;

  const editable = lifecycle.canEditEntries;
  const days = useMemo(() => {
    if (!week) return [];
    const today = toIsoDate(new Date());
    return datesInRange(week.start, week.end).map((date) => {
      const jsDay = new Date(`${date}T00:00:00`).getDay();
      return {
        date,
        dayName: dayName(date),
        isFuture: date > today,
        isToday: date === today,
        isWeekend: jsDay === 0 || jsDay === 6,
      };
    });
  }, [week]);
  const isoWeek = useMemo(
    () => (week ? isoWeekLabel(week.start) : isoWeekLabel(weekMonday)),
    [week, weekMonday],
  );
  const isCurrentPeriod = useMemo(() => {
    if (!week) return false;
    const today = toIsoDate(new Date());
    return today >= week.start && today <= week.end;
  }, [week]);

  const allEntries = useMemo(
    () => Object.values(entriesByDay).flat(),
    [entriesByDay],
  );

  const weekStats: WeekStats = useMemo(
    () => computeWeekStatsFromPersisted(allEntries),
    [allEntries],
  );

  const byProject = useMemo(
    () =>
      groupHoursByProject(
        allEntries.map((e) => ({
          id: e.id,
          entry_date: e.entry_date,
          total_hours: e.total_hours,
          billable: e.billable,
          project_id: e.project_id,
          asana_project_id: e.asana_project_id,
          asana_project_name:
            asanaImportedProjects.find((p) => p.id === e.asana_project_id)
              ?.asana_project_name ?? null,
        })),
        projects,
        asanaImportedProjects,
      ),
    [allEntries, projects, asanaImportedProjects],
  );

  const billableHours = useMemo(
    () => byProject.reduce((sum, p) => sum + p.billableHours, 0),
    [byProject],
  );

  const totalHours = weekStats.totalHours;
  const showEarnings = rateType === "hourly" && rate != null;
  const showOvertimeNotice = totalHours > OVERTIME_HOURS_THRESHOLD;

  function entryIsPersistable(entry: DraftEntry): boolean {
    return entry.entry_mode === "decimal_hours"
      ? canPersistDecimalEntry(entry.decimal_hours)
      : canPersistTimeEntry(entry.start_time, entry.end_time);
  }

  const load = useCallback(async () => {
    // Guard against out-of-order responses when the user switches weeks
    // quickly — only the latest request is allowed to apply its result.
    const seq = ++loadSeq.current;
    setLoading(true);
    const res = await getTimeTrackingData(
      weekMonday,
      orgIdRef.current ? undefined : personalLengthDays,
    );
    if (seq !== loadSeq.current) return;
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
      setAsanaConnected,
      setAsanaImportedProjects,
      setAsanaProjectNamesSyncedAt,
      setWeek,
      setRate,
      setRateType,
      setCurrency,
      setSubmittedAt,
      setEditRequestStatus,
      setEditRequestNote,
      setEntriesByDay,
    });
    if (!res.orgId) {
      const length = periodLengthDays(res.week.start, res.week.end);
      if (length === 7 || length === 15 || length === 30) {
        setPersonalLengthDays(length);
      }
    }
  }, [weekMonday, personalLengthDays, toast]);

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
        setAsanaConnected,
        setAsanaImportedProjects,
        setAsanaProjectNamesSyncedAt,
        setWeek,
        setRate,
        setRateType,
        setCurrency,
        setSubmittedAt,
        setEditRequestStatus,
        setEditRequestNote,
        setEntriesByDay,
      });
      if (!initialData.orgId) {
        const length = periodLengthDays(initialData.week.start, initialData.week.end);
        if (length === 7 || length === 15 || length === 30) {
          setPersonalLengthDays(length);
        }
      }
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

  useEffect(() => {
    if (prefillApplied.current || !initialPrefill) return;
    prefillApplied.current = true;

    const date = initialFocusDate ?? initialPrefill.date;
    if (!days.some((d) => d.date === date)) return;

    const times = {
      start_time: new Date(initialPrefill.start).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      end_time: new Date(initialPrefill.end).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      description: initialPrefill.title,
    };

    setEntriesByDay((prev) => ({
      ...prev,
      [date]: [
        ...(prev[date] ?? []),
        {
          ...newDraft(date),
          ...times,
        },
      ],
    }));
  }, [initialPrefill, initialFocusDate, days]);

  function addEntryFromCalendar(
    date: string,
    event: GoogleCalendarEventWithMeta,
  ) {
    const times = googleEventToDraftTimes(event);
    setEntriesByDay((prev) => ({
      ...prev,
      [date]: [
        ...(prev[date] ?? []),
        {
          ...newDraft(date),
          start_time: times.start_time,
          end_time: times.end_time,
          description: times.description,
        },
      ],
    }));
  }

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
    async (
      date: string,
      clientId: string,
      overrides?: Partial<DraftEntry>,
      options?: { collapse?: boolean },
    ) => {
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
        if (!tsId || !empId) {
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

        updateEntry(date, clientId, { saveState: "saving", error: undefined });

        const res = await saveTimeEntryClient({
          id: entry.id,
          orgId: org || null,
          employeeId: empId,
          timesheetId: tsId,
          entryDate: entry.entry_date,
          entryMode: entry.entry_mode,
          startTime: entry.start_time,
          endTime: entry.end_time,
          decimalHours: entry.decimal_hours,
          projectId: entry.project_id,
          asanaProjectId: entry.asana_project_id,
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
          asana_project_id: entry.asana_project_id,
          description: entry.description,
          billable: entry.billable,
          ...(options?.collapse ? { collapsed: true } : {}),
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

  async function handleAsanaSync() {
    setAsanaSyncPending(true);
    try {
      const result = await syncImportedAsanaProjectNames();
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      if (
        result.message &&
        result.message !== "All project names are up to date."
      ) {
        toast(result.message, "success");
      }
      setAsanaProjectNamesSyncedAt(new Date().toISOString());
      await load();
    } finally {
      setAsanaSyncPending(false);
    }
  }

  async function handleRequestEdit() {
    if (!timesheetId || !requestEditNote.trim()) return;
    setRequestEditPending(true);
    try {
      const result = await requestTimesheetEdit(timesheetId, requestEditNote.trim());
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setRequestEditOpen(false);
        setRequestEditNote("");
        await load();
      }
    } finally {
      setRequestEditPending(false);
    }
  }

  async function handleCopyEntry() {
    if (!copySource?.id) return;
    setCopyPending(true);
    try {
      const result = await copyTimeEntryToDays({
        sourceEntryId: copySource.id,
        targetDates: copyTargets,
      });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setCopySource(null);
        setCopyTargets([]);
        await load();
      }
    } finally {
      setCopyPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg font-medium tracking-tightest text-ink">
              {week?.label ?? "…"}
            </p>
            <p className="tabular text-sm text-muted">{isoWeek}</p>
            <div className="mt-1">
              <TimesheetStatusPill status={status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-card)] bg-surface p-1.5 shadow-card">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!week) return;
                setWeekMonday(addDays(week.start, -1));
              }}
            >
              ← Prev period
            </Button>
            <Button
              type="button"
              variant={isCurrentPeriod ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setWeekMonday(toIsoDate(new Date()))}
            >
              Current period
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!week) return;
                setWeekMonday(addDays(week.end, 1));
              }}
            >
              Next period →
            </Button>
            {!orgId && (
              <select
                value={String(personalLengthDays)}
                onChange={(event) =>
                  setPersonalLengthDays(Number(event.target.value) as 7 | 15 | 30)
                }
                className="h-8 rounded-[var(--radius-input)] border border-[var(--line)] bg-surface px-2 text-xs text-ink"
                aria-label="Personal period length"
              >
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <LogWeekSkeleton />
        ) : (
          days.map((day) => (
            <div
              key={day.date}
              className={cn(
                "rounded-[var(--radius-card)] bg-surface p-5 shadow-card",
                day.isToday && "border-l-4 border-l-[var(--accent)]",
                day.isFuture && !day.isWeekend && "opacity-80",
                day.isWeekend &&
                  "border border-dashed border-[var(--line)] bg-surface-low",
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
                  <p className="tabular text-sm text-muted">
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
                      asanaConnected={asanaConnected}
                      asanaImportedProjects={asanaImportedProjects}
                      asanaProjectNamesSyncedAt={asanaProjectNamesSyncedAt}
                      asanaSyncPending={asanaSyncPending}
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
                      onSave={() =>
                        persistEntry(day.date, entry.clientId, undefined, {
                          collapse: true,
                        })
                      }
                      onDelete={() => removeEntry(entry)}
                      onBillableChange={(next) => {
                        updateEntry(day.date, entry.clientId, {
                          billable: next,
                          billableTouched: true,
                          saveState: "idle",
                        });
                        const cur = getEntry(day.date, entry.clientId);
                        if (cur && entryIsPersistable(cur)) {
                          void persistEntry(day.date, entry.clientId, {
                            billable: next,
                          });
                        }
                      }}
                      onProjectPick={(pick) => {
                        const pickedProject = pick.projectId
                          ? projects.find((p) => p.id === pick.projectId)
                          : null;
                        const seedBillable =
                          pickedProject &&
                          !entry.billableTouched &&
                          pick.projectId
                            ? (pickedProject.billable_default ?? true)
                            : undefined;

                        updateEntry(day.date, entry.clientId, {
                          project_id: pick.projectId,
                          asana_project_id: pick.asanaProjectId,
                          ...(seedBillable !== undefined
                            ? { billable: seedBillable }
                            : {}),
                          saveState: "idle",
                        });
                        const cur = getEntry(day.date, entry.clientId);
                        if (cur && entryIsPersistable(cur)) {
                          void persistEntry(day.date, entry.clientId, {
                            project_id: pick.projectId,
                            asana_project_id: pick.asanaProjectId,
                            ...(seedBillable !== undefined
                              ? { billable: seedBillable }
                              : {}),
                          });
                        }
                      }}
                      onAsanaSync={() => void handleAsanaSync()}
                      onCreateProject={handleCreateProject}
                      onExpand={() =>
                        updateEntry(day.date, entry.clientId, { collapsed: false })
                      }
                      onCopy={() => {
                        if (!entry.id) return;
                        setCopySource(entry);
                        setCopyTargets([]);
                      }}
                    />
                  ))}
                </AnimatePresence>

                {(entriesByDay[day.date] ?? []).length === 0 && (
                  <p className="text-sm text-muted">No entries for this day.</p>
                )}

                {(calendarEventsByDay[day.date] ?? []).length > 0 ? (
                  <details className="mt-2 rounded-[var(--radius-input)] border border-line bg-surface-low">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs text-muted [&::-webkit-details-marker]:hidden">
                      <GoogleCalendarIcon size={14} />
                      From calendar
                    </summary>
                    <ul className="divide-y divide-line border-t border-line">
                      {(calendarEventsByDay[day.date] ?? []).map((event) => (
                        <li
                          key={event.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-ink">
                              {event.title ?? "Untitled event"}
                            </p>
                            <p className="text-xs text-muted">
                              {formatGoogleEventTimeRange(event)}
                            </p>
                          </div>
                          {editable ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => addEntryFromCalendar(day.date, event)}
                            >
                              Add
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <aside className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-5 shadow-card lg:sticky lg:top-6 lg:self-start">
        {loading ? (
          <LogSummarySkeleton />
        ) : (
          <>
            <h3 className="font-display text-base font-medium tracking-tightest text-ink">
              Period summary
            </h3>

            {lifecycle.showReminderBanner && (
              <p className="rounded-[var(--radius-card)] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-strong)]">
                Submission window is open for this period.
              </p>
            )}

            <div className="border-b border-[var(--line)] pb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Total hours
              </p>
              <p className="tabular mt-1 text-3xl font-semibold text-ink">
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
                        {p.source === "asana" ? (
                          <AsanaIcon size={16} />
                        ) : (
                          <span
                            className={cn(
                              "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                              p.source === "none" && "bg-muted",
                            )}
                            style={
                              p.source === "cadence"
                                ? { backgroundColor: p.color }
                                : undefined
                            }
                          />
                        )}
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="tabular shrink-0 font-medium">
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
                <p className="tabular mt-0.5 font-medium text-ink">
                  {billableHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Non-billable</p>
                <p className="tabular mt-0.5 font-medium text-ink">
                  {(totalHours - billableHours).toFixed(1)}h
                </p>
              </div>
            </div>

            {showEarnings && (
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-xs text-muted">Estimated earnings</p>
                <p className="tabular mt-0.5 font-medium text-ink">
                  {currency ?? "USD"}{" "}
                  {(totalHours * (rate ?? 0)).toFixed(2)}
                </p>
              </div>
            )}

            <div className="border-t border-[var(--line)] pt-4">
              <p className="text-xs text-muted">Entry count</p>
              <p className="tabular mt-0.5 text-sm font-medium text-ink">
                {allEntries.length} {allEntries.length === 1 ? "entry" : "entries"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Informational only — gaps in days are allowed.
              </p>
            </div>

            {showOvertimeNotice && editable && (
              <p className="rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-strong)]">
                <span className="tabular font-medium">
                  {(totalHours - OVERTIME_HOURS_THRESHOLD).toFixed(1)}h
                </span>{" "}
                overtime — your manager will approve the extra time.
              </p>
            )}

            {lifecycle.stage === "submittable" && (
              <Button
                className="w-full"
                disabled={pending || !timesheetId}
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
                Submit timesheet
              </Button>
            )}

            {lifecycle.stage === "submitted_editable" && (
              <p className="text-sm text-muted">
                You can still edit this submission until{" "}
                <span className="tabular font-medium text-ink">
                  {lifecycle.submittedEditEndsOn}
                </span>
                .
              </p>
            )}

            {lifecycle.stage === "locked" && (
              <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-surface-low p-3">
                <p className="text-sm text-ink">
                  This timesheet is locked. Request edit access to make changes.
                </p>
                {editRequestStatus === "pending" ? (
                  <p className="mt-1 text-xs text-muted">
                    Edit request pending review.
                    {editRequestNote ? ` Reason: ${editRequestNote}` : ""}
                  </p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    onClick={() => setRequestEditOpen(true)}
                  >
                    Request edit
                  </Button>
                )}
              </div>
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

      <MotionModal
        open={requestEditOpen}
        onClose={() => {
          if (requestEditPending) return;
          setRequestEditOpen(false);
        }}
        panelClassName="max-w-md"
      >
        <h3 className="font-display text-base font-semibold text-ink">
          Request edit access
        </h3>
        <p className="mt-1 text-sm text-muted">
          Add a short reason. In personal workspace this unlocks immediately;
          in organization workspace it routes to configured approvers.
        </p>
        <textarea
          value={requestEditNote}
          onChange={(event) => setRequestEditNote(event.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Why do you need to update this timesheet?"
          className="mt-4 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-surface px-3 py-2 text-sm text-ink"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={requestEditPending}
            onClick={() => setRequestEditOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={requestEditPending}
            disabled={!requestEditNote.trim()}
            onClick={() => void handleRequestEdit()}
          >
            Send request
          </Button>
        </div>
      </MotionModal>

      <MotionModal
        open={Boolean(copySource)}
        onClose={() => {
          if (copyPending) return;
          setCopySource(null);
        }}
        panelClassName="max-w-lg"
      >
        <h3 className="font-display text-base font-semibold text-ink">
          Copy entry to other days
        </h3>
        <p className="mt-1 text-sm text-muted">
          Select one or more target days in this period.
        </p>
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-[var(--radius-input)] border border-[var(--line)] p-3">
          {days.map((day) => {
            const disabled = day.date === copySource?.entry_date;
            const checked = copyTargets.includes(day.date);
            return (
              <label
                key={day.date}
                className={cn(
                  "flex items-center justify-between rounded-[var(--radius-input)] px-2 py-1.5 text-sm",
                  disabled ? "opacity-50" : "hover:bg-surface-low",
                )}
              >
                <span>
                  {day.dayName} · {day.date}
                </span>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={(event) => {
                    setCopyTargets((prev) => {
                      if (event.target.checked) return [...prev, day.date];
                      return prev.filter((date) => date !== day.date);
                    });
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={copyPending}
            onClick={() => setCopySource(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={copyPending}
            disabled={copyTargets.length === 0}
            onClick={() => void handleCopyEntry()}
          >
            Copy to selected days
          </Button>
        </div>
      </MotionModal>
    </div>
  );
}
