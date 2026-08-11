"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { canPersistDecimalEntry } from "@/lib/time/decimal-hours";
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
  isoWeekLabel,
  periodDays,
  shiftViewPeriod,
  thisWeekMonday,
  toIsoDate,
  viewPeriodForDate,
  type PayPeriod,
  type ViewPeriodCadence,
} from "@/lib/time/periods";
import {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";
import type { TimesheetStatus } from "@/types/db";
import type { AsanaImportedProject } from "@/types/db";
import type { Project } from "@/types/time-tracking";
import type { LinkedEmailThreadMeta, TimeTrackingData } from "@/types/time-tracking";
import {
  copyEntriesFromPreviousPeriod,
  getTimeTrackingData,
  lockPersonalTimesheet,
  requestPersonalTimesheetEdit,
  submitPersonalTimesheet,
  submitTimesheetForApproval,
} from "./time-actions";
import { createProject } from "../projects/actions";
import { syncImportedAsanaProjectNames } from "../profile/asana-actions";
import { LogWeekSkeleton } from "./LogWeekSkeleton";
import { TimeEntryRow } from "./TimeEntryRow";
import { cn } from "@/lib/utils";

import { CopyEntriesDialog } from "./CopyEntriesDialog";
import { RequestEditDialog } from "./RequestEditDialog";
import { TimeTrackingPeriodNavigation } from "./TimeTrackingPeriodNavigation";
import { TimeTrackingSummary } from "./TimeTrackingSummary";
import { useTimeEntryPersistence } from "./useTimeEntryPersistence";
import {
  applyTrackingData,
  daysSince,
  daysUntil,
  editWindowLabel,
  newDraft,
  type DraftEntry,
} from "./time-tracking-view-helpers";

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
  const router = useRouter();
  const today = toIsoDate(new Date());
  const defaultAnchor = initialWeekMonday ?? thisWeekMonday();
  const [periodAnchor, setPeriodAnchor] = useState(defaultAnchor);
  const [viewCadence, setViewCadence] = useState<ViewPeriodCadence>("weekly");
  const [week, setWeek] = useState<PayPeriod | null>(null);
  const [timesheetId, setTimesheetId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<TimesheetStatus>("draft");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [asanaConnected, setAsanaConnected] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [emailLinksByEntryId, setEmailLinksByEntryId] = useState<
    Record<string, LinkedEmailThreadMeta[]>
  >({});
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
  const [requestEditNote, setRequestEditNote] = useState("");
  const [requestEditOpen, setRequestEditOpen] = useState(false);
  const [copyPending, setCopyPending] = useState(false);
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [copySource, setCopySource] = useState<{
    date: string;
    entry: DraftEntry;
  } | null>(null);
  const [copySelectedDates, setCopySelectedDates] = useState<Set<string>>(
    () => new Set(),
  );
  const skipInitialFetch = useRef(Boolean(initialData));
  const prefillApplied = useRef(false);
  const ssrPeriodAnchor = defaultAnchor;
  const ssrViewCadence = useRef<ViewPeriodCadence>("weekly");

  const loadSeq = useRef(0);
  const entriesByDayRef = useRef(entriesByDay);
  const timesheetIdRef = useRef(timesheetId);
  const orgIdRef = useRef(orgId);
  const employeeIdRef = useRef(employeeId);
  const editableRef = useRef(status === "draft" || status === "submitted" || status === "rejected");
  const { debounceTimers, inFlightSaves } = useTimeEntryPersistence();

  entriesByDayRef.current = entriesByDay;
  timesheetIdRef.current = timesheetId;
  orgIdRef.current = orgId;
  employeeIdRef.current = employeeId;

  const hasOrgContext = Boolean(orgId);
  const isPersonalWorkspace = !hasOrgContext;

  const editWindowDaysLeft = useMemo(() => {
    if (!isPersonalWorkspace || status !== "submitted" || !submittedAt) return null;
    return Math.max(0, 3 - daysSince(submittedAt));
  }, [isPersonalWorkspace, status, submittedAt]);

  const isWithinEditWindow =
    editWindowDaysLeft !== null && editWindowDaysLeft > 0;
  const isPersonalLocked = isPersonalWorkspace && status === "approved";

  const editable =
    !isPersonalLocked &&
    (status === "draft" ||
      (status === "submitted" &&
        (isPersonalWorkspace ? isWithinEditWindow : true)) ||
      status === "rejected");

  editableRef.current = editable;

  const days = useMemo(
    () => (week ? periodDays(week) : periodDays(viewPeriodForDate(periodAnchor, viewCadence))),
    [week, periodAnchor, viewCadence],
  );
  const isoWeek = useMemo(() => isoWeekLabel(week?.start ?? periodAnchor), [week, periodAnchor]);
  const currentViewPeriod = useMemo(
    () => viewPeriodForDate(today, viewCadence),
    [today, viewCadence],
  );
  const isCurrentPeriod = week?.start === currentViewPeriod.start;

  const daysUntilPeriodEnd = week ? daysUntil(week.end) : null;
  const canPersonalSubmit =
    isPersonalWorkspace &&
    daysUntilPeriodEnd !== null &&
    daysUntilPeriodEnd <= 3 &&
    daysUntilPeriodEnd >= 0;

  const previousPeriod = useMemo(() => {
    if (!week) return null;
    return shiftViewPeriod(week, viewCadence, -1);
  }, [week, viewCadence]);

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
    const res = await getTimeTrackingData(periodAnchor, viewCadence);
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
      setSubmittedAt,
      setProjects,
      setAsanaConnected,
      setGmailConnected,
      setEmailLinksByEntryId,
      setAsanaImportedProjects,
      setAsanaProjectNamesSyncedAt,
      setWeek,
      setRate,
      setRateType,
      setCurrency,
      setEntriesByDay,
    });

    if (isPersonalWorkspace && res.status === "submitted" && res.submittedAt) {
      const daysPassed = daysSince(res.submittedAt);
      if (daysPassed >= 3) {
        void lockPersonalTimesheet(res.timesheetId).then((lockRes) => {
          if (lockRes.ok) {
            setStatus("approved");
            setSubmittedAt(res.submittedAt ?? null);
          }
        });
      }
    }
  }, [periodAnchor, viewCadence, toast, isPersonalWorkspace]);

  useEffect(() => {
    if (
      skipInitialFetch.current &&
      initialData &&
      periodAnchor === ssrPeriodAnchor &&
      viewCadence === ssrViewCadence.current
    ) {
      skipInitialFetch.current = false;
      applyTrackingData(initialData, {
        setTimesheetId,
        setOrgId,
        setEmployeeId,
        setStatus,
        setSubmittedAt,
        setProjects,
        setAsanaConnected,
        setGmailConnected,
        setEmailLinksByEntryId,
        setAsanaImportedProjects,
        setAsanaProjectNamesSyncedAt,
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
  }, [load, periodAnchor, viewCadence, initialData, ssrPeriodAnchor]);

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
    [inFlightSaves],
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
    [debounceTimers, persistEntry],
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

  async function copyEntryToDays(
    sourceDate: string,
    source: DraftEntry,
    targetDates: string[],
  ) {
    if (!editable || !week) return;
    if (!entryIsPersistable(source)) {
      toast("Save this entry before copying.", "error");
      return;
    }
    if (targetDates.length === 0) return;

    let copied = 0;
    for (const date of targetDates) {
      const draft: DraftEntry = {
        ...newDraft(date, source.end_time || undefined),
        entry_mode: source.entry_mode,
        start_time: source.start_time,
        end_time: source.end_time,
        decimal_hours: source.decimal_hours,
        project_id: source.project_id,
        asana_project_id: source.asana_project_id,
        description: source.description,
        billable: source.billable,
        billableTouched: true,
        saveState: "idle",
        collapsed: false,
      };
      setEntriesByDay((prev) => ({
        ...prev,
        [date]: [...(prev[date] ?? []), draft],
      }));
      await persistEntry(date, draft.clientId, draft, { collapse: true });
      copied++;
    }

    toast(
      copied === 1
        ? "Entry copied to 1 day."
        : `Entry copied to ${copied} days.`,
      "success",
    );
  }

  function openCopyPicker(sourceDate: string, source: DraftEntry) {
    if (!editable || !week) return;
    if (!entryIsPersistable(source)) {
      toast("Save this entry before copying.", "error");
      return;
    }
    setCopySource({ date: sourceDate, entry: source });
    setCopySelectedDates(new Set());
    setCopyPickerOpen(true);
  }

  function toggleCopyTarget(date: string) {
    setCopySelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function confirmCopyToSelectedDays() {
    if (!copySource) return;
    const targets = [...copySelectedDates];
    if (targets.length === 0) {
      toast("Select at least one day to copy to.", "error");
      return;
    }
    setCopyPickerOpen(false);
    await copyEntryToDays(copySource.date, copySource.entry, targets);
    setCopySource(null);
    setCopySelectedDates(new Set());
  }

  function formatCopyDayLabel(date: string, dayName: string): string {
    const formatted = new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
    return `${dayName}, ${formatted}`;
  }

  async function handleCopyFromPrevious() {
    setCopyPending(true);
    try {
      const res = await copyEntriesFromPreviousPeriod(periodAnchor, viewCadence);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) await load();
    } finally {
      setCopyPending(false);
    }
  }

  async function handleRequestEdit() {
    const res = await requestPersonalTimesheetEdit(timesheetId, requestEditNote);
    toast(res.message, res.ok ? "success" : "error");
    if (res.ok) {
      setRequestEditOpen(false);
      setRequestEditNote("");
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TimesheetStatusPill status={status} />
              {isPersonalWorkspace && status === "submitted" && isWithinEditWindow && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-strong)]">
                  {editWindowLabel(submittedAt)}
                </span>
              )}
              {isPersonalLocked && (
                <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
                  Locked
                </span>
              )}
            </div>
          </div>
          <TimeTrackingPeriodNavigation
            viewCadence={viewCadence}
            isCurrentPeriod={isCurrentPeriod}
            onCadenceChange={(cadence) => {
              setViewCadence(cadence);
              setPeriodAnchor(today);
            }}
            onPrevious={() => {
              const period = week ?? viewPeriodForDate(periodAnchor, viewCadence);
              setPeriodAnchor(shiftViewPeriod(period, viewCadence, -1).start);
            }}
            onCurrent={() => setPeriodAnchor(currentViewPeriod.start)}
            onNext={() => {
              const period = week ?? viewPeriodForDate(periodAnchor, viewCadence);
              setPeriodAnchor(shiftViewPeriod(period, viewCadence, 1).start);
            }}
          />
        </div>

        {isPersonalLocked && (
          <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--danger)]">
              This timesheet is locked and can no longer be edited.
            </p>
            <button
              type="button"
              onClick={() => setRequestEditOpen(true)}
              className="mt-1 text-sm font-medium text-[var(--danger)] underline underline-offset-2 hover:opacity-80"
            >
              Request edit access
            </button>
          </div>
        )}

        <RequestEditDialog
          open={requestEditOpen}
          note={requestEditNote}
          onNoteChange={setRequestEditNote}
          onClose={() => setRequestEditOpen(false)}
          onSave={() => void handleRequestEdit()}
        />

        <CopyEntriesDialog
          open={copyPickerOpen}
          sourceDate={copySource?.date ?? null}
          days={days}
          selectedDates={copySelectedDates}
          onToggle={toggleCopyTarget}
          onCancel={() => {
            setCopyPickerOpen(false);
            setCopySource(null);
            setCopySelectedDates(new Set());
          }}
          onConfirm={() => void confirmCopyToSelectedDays()}
          formatDayLabel={formatCopyDayLabel}
        />

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
                          field === "description" ||
                          field === "decimal_hours"
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
                      onCopy={
                        editable && entry.id
                          ? () => openCopyPicker(day.date, entry)
                          : undefined
                      }
                      gmailConnected={gmailConnected}
                      linkedEmailThreads={
                        entry.id ? emailLinksByEntryId[entry.id] ?? [] : []
                      }
                      onEmailLinksChanged={() => {
                        void load();
                        router.refresh();
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

      <TimeTrackingSummary loading={loading}>
          <>
            <h3 className="font-display text-base font-medium tracking-tightest text-ink">
              {isPersonalWorkspace ? "Period summary" : "Week summary"}
            </h3>

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

            {hasOrgContext && (
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-xs text-muted">Submit progress</p>
                <p className="tabular mt-0.5 text-sm font-medium text-ink">
                  {weekStats.daysLogged} / {SUBMIT_MIN_DAYS} days ·{" "}
                  {weekStats.totalHours.toFixed(1)} / {SUBMIT_MIN_HOURS}.0h
                </p>
              </div>
            )}

            {showOvertimeNotice && editable && hasOrgContext && (
              <p className="rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-strong)]">
                <span className="tabular font-medium">
                  {(totalHours - OVERTIME_HOURS_THRESHOLD).toFixed(1)}h
                </span>{" "}
                overtime — your manager will approve the extra time.
              </p>
            )}

            {editable && hasOrgContext && (
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

            {isPersonalWorkspace && status === "draft" && (
              <div className="border-t border-[var(--line)] pt-4">
                {canPersonalSubmit ? (
                  <p className="mb-2 text-xs text-muted">
                    {daysUntilPeriodEnd === 0
                      ? "Period ends today"
                      : `${daysUntilPeriodEnd} day${daysUntilPeriodEnd === 1 ? "" : "s"} until period ends`}
                  </p>
                ) : (
                  <p className="mb-2 text-xs text-muted">
                    Available to submit{" "}
                    {daysUntilPeriodEnd !== null && daysUntilPeriodEnd > 0
                      ? `in ${daysUntilPeriodEnd - 3} more day${daysUntilPeriodEnd - 3 === 1 ? "" : "s"}`
                      : "soon"}
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={pending || !timesheetId || !canPersonalSubmit}
                  title={
                    !canPersonalSubmit
                      ? "Submit becomes available 3 days before the period ends"
                      : undefined
                  }
                  onClick={() => {
                    const tsId = timesheetIdRef.current;
                    if (!tsId) {
                      toast("Still loading — try again in a moment.", "error");
                      return;
                    }
                    startTransition(async () => {
                      const res = await submitPersonalTimesheet(tsId);
                      toast(res.message, res.ok ? "success" : "error");
                      if (res.ok) {
                        setStatus("submitted");
                        setSubmittedAt(new Date().toISOString());
                      }
                    });
                  }}
                >
                  Mark as complete
                </Button>
              </div>
            )}

            {isPersonalWorkspace && status === "submitted" && isWithinEditWindow && (
              <div className="rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-strong)]">
                {editWindowLabel(submittedAt)} — you can still make changes.
              </div>
            )}

            {isPersonalLocked && (
              <div className="border-t border-[var(--line)] pt-4">
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setRequestEditOpen(true)}
                >
                  Request edit access
                </Button>
              </div>
            )}

            {isPersonalWorkspace && status === "draft" && previousPeriod && (
              <div className="border-t border-[var(--line)] pt-4">
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  disabled={copyPending}
                  onClick={() => void handleCopyFromPrevious()}
                >
                  {copyPending ? "Copying…" : "Copy entries from previous period"}
                </Button>
              </div>
            )}

            <Link
              href="/app/projects"
              className="text-center text-sm font-medium text-[var(--accent-strong)] hover:underline"
            >
              Manage projects
            </Link>
          </>
      </TimeTrackingSummary>
    </div>
  );
}
