import { entryHoursWithPersistedFallback } from "@/lib/time/entry-hours";
import { toIsoDate, type PayPeriod } from "@/lib/time/periods";
import type { AsanaImportedProject, TimesheetStatus } from "@/types/db";
import type { Project, TimeEntryWithProject, LinkedEmailThreadMeta, TimeTrackingData } from "@/types/time-tracking";
import type { EntryMode } from "@/lib/time/decimal-hours";
import type { EntryRowData } from "./TimeEntryRow";

export type DraftEntry = EntryRowData;

export function newDraft(date: string, lastEnd?: string): DraftEntry {
  return { clientId: crypto.randomUUID(), entry_date: date, entry_mode: "time_range", start_time: lastEnd ?? "09:00", end_time: lastEnd ? "" : "17:00", decimal_hours: "", project_id: null, asana_project_id: null, description: "", billable: true, billableTouched: false, saveState: "idle", collapsed: false };
}

function entryToDraft(e: TimeEntryWithProject): DraftEntry {
  const mode = (e.entry_mode ?? "time_range") as EntryMode;
  const start = e.start_time.slice(0, 5);
  const end = e.end_time.slice(0, 5);
  const computedHours = entryHoursWithPersistedFallback({ ...e, entry_mode: mode, start_time: start, end_time: end });
  return { clientId: e.id, id: e.id, entry_date: e.entry_date, entry_mode: mode, start_time: start, end_time: end, decimal_hours: mode === "decimal_hours" && e.decimal_hours != null ? String(e.decimal_hours) : "", project_id: e.project_id, asana_project_id: e.asana_project_id ?? null, description: e.description ?? "", billable: e.billable, billableTouched: true, total_hours: computedHours, saveState: "saved", collapsed: true };
}

export function entriesGrouped(entries: TimeEntryWithProject[]): Record<string, DraftEntry[]> {
  const grouped: Record<string, DraftEntry[]> = {};
  for (const entry of entries) {
    grouped[entry.entry_date] = grouped[entry.entry_date] ?? [];
    grouped[entry.entry_date]!.push(entryToDraft(entry));
  }
  return grouped;
}

export function applyTrackingData(data: TimeTrackingData, setters: {
  setTimesheetId: (v: string) => void; setOrgId: (v: string) => void; setEmployeeId: (v: string) => void; setStatus: (v: TimesheetStatus) => void; setSubmittedAt: (v: string | null) => void; setProjects: (v: Project[]) => void; setAsanaConnected: (v: boolean) => void; setGmailConnected: (v: boolean) => void; setEmailLinksByEntryId: (v: Record<string, LinkedEmailThreadMeta[]>) => void; setAsanaImportedProjects: (v: AsanaImportedProject[]) => void; setAsanaProjectNamesSyncedAt: (v: string | null) => void; setWeek: (v: PayPeriod) => void; setRate: (v: number | null) => void; setRateType: (v: string) => void; setCurrency: (v: string | null) => void; setEntriesByDay: (v: Record<string, DraftEntry[]>) => void;
}) {
  setters.setTimesheetId(data.timesheetId); setters.setOrgId(data.orgId ?? ""); setters.setEmployeeId(data.employeeId); setters.setStatus(data.status); setters.setSubmittedAt(data.submittedAt ?? null); setters.setProjects(data.projects); setters.setAsanaConnected(data.asanaConnected); setters.setGmailConnected(data.gmailConnected);
  const linksMap: Record<string, LinkedEmailThreadMeta[]> = {};
  for (const entry of data.entries) if (entry.linked_email_threads?.length) linksMap[entry.id] = entry.linked_email_threads;
  setters.setEmailLinksByEntryId(linksMap); setters.setAsanaImportedProjects(data.asanaImportedProjects); setters.setAsanaProjectNamesSyncedAt(data.asanaProjectNamesSyncedAt); setters.setWeek(data.week); setters.setRate(data.rate); setters.setRateType(data.rateType); setters.setCurrency(data.currency); setters.setEntriesByDay(entriesGrouped(data.entries));
}

export function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - new Date(toIsoDate(new Date())).getTime()) / 86_400_000);
}
export function daysSince(isoTimestamp: string | null): number {
  if (!isoTimestamp) return 0;
  return Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 86_400_000);
}
export function editWindowLabel(submittedAt: string | null): string | null {
  if (!submittedAt) return null;
  const daysLeft = 3 - daysSince(submittedAt);
  if (daysLeft <= 0) return null;
  return daysLeft === 1 ? "1 day left to edit" : `${daysLeft} days left to edit`;
}
