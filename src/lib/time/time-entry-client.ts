"use client";

import { createClient } from "@/lib/supabase/client";
import {
  canPersistDecimalEntry,
  parseDecimalHours,
  syntheticTimesForDecimalHours,
  type EntryMode,
} from "@/lib/time/decimal-hours";
import {
  durationHours,
  hoursBetween,
  isOvernightShift,
  parseTime,
  rangesOverlap,
  toRange,
} from "@/lib/time/validation";

/**
 * Insert/update payload keys allowed by the live `time_entries` schema.
 * NOTE: `is_overnight` is intentionally absent — it is NOT a real DB column.
 * Overnight is derived locally (see `built.overnight`) for overlap logic and
 * display only; it must never be written to Supabase.
 */
export type TimeEntryWriteRow = {
  org_id: string | null;
  employee_id: string;
  timesheet_id: string;
  project_id: string | null;
  asana_project_id: string | null;
  entry_date: string;
  start_time: string;
  end_time: string;
  entry_mode: EntryMode;
  decimal_hours: number | null;
  description: string | null;
  billable: boolean;
};

/** Build result — the DB row plus a locally-derived overnight flag (not persisted). */
type BuiltWriteRow = { row: TimeEntryWriteRow; overnight: boolean };

export type SaveTimeEntryInput = {
  id?: string;
  orgId: string | null;
  employeeId: string;
  timesheetId: string;
  entryDate: string;
  entryMode?: EntryMode;
  startTime: string;
  endTime: string;
  decimalHours?: string;
  projectId?: string | null;
  asanaProjectId?: string | null;
  description?: string;
  billable?: boolean;
};

export type SaveTimeEntryResult =
  | { ok: true; id: string; total_hours: number }
  | { ok: false; message: string };

function buildWriteRow(input: SaveTimeEntryInput): BuiltWriteRow | SaveTimeEntryResult {
  if (!input.employeeId?.trim()) {
    return { ok: false, message: "Missing employee profile — sign in again." };
  }
  if (!input.timesheetId?.trim()) {
    return { ok: false, message: "Timesheet not ready — refresh and try again." };
  }

  const orgId =
    input.orgId && String(input.orgId).trim() !== "" ? String(input.orgId) : null;

  const projectId =
    input.projectId && String(input.projectId).trim() !== ""
      ? String(input.projectId)
      : null;

  const asanaProjectId =
    input.asanaProjectId && String(input.asanaProjectId).trim() !== ""
      ? String(input.asanaProjectId)
      : null;

  const mode: EntryMode = input.entryMode ?? "time_range";

  if (mode === "decimal_hours") {
    const hours = parseDecimalHours(input.decimalHours ?? "");
    if (hours === null) {
      return { ok: false, message: "Enter total hours (e.g. 7.5), up to 24." };
    }
    const synthetic = syntheticTimesForDecimalHours(hours);
    return {
      overnight: false,
      row: {
        org_id: orgId,
        employee_id: input.employeeId,
        timesheet_id: input.timesheetId,
        project_id: projectId,
        asana_project_id: asanaProjectId,
        entry_date: input.entryDate,
        start_time: synthetic.start_time,
        end_time: synthetic.end_time,
        entry_mode: "decimal_hours",
        decimal_hours: hours,
        description: input.description?.trim() || null,
        billable: input.billable ?? true,
      },
    };
  }

  const start = parseTime(input.startTime);
  const end = parseTime(input.endTime);
  if (!start) return { ok: false, message: "Start time is required." };
  if (!end) return { ok: false, message: "End time is required." };

  const overnight = isOvernightShift(start, end);
  if (!overnight && end <= start) {
    return { ok: false, message: "End time must be after start time." };
  }

  return {
    overnight,
    row: {
      org_id: orgId,
      employee_id: input.employeeId,
      timesheet_id: input.timesheetId,
      project_id: projectId,
      asana_project_id: asanaProjectId,
      entry_date: input.entryDate,
      start_time: start,
      end_time: end,
      entry_mode: "time_range",
      decimal_hours: null,
      description: input.description?.trim() || null,
      billable: input.billable ?? true,
    },
  };
}

function isPersistableTimePair(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const s = parseTime(String(start).slice(0, 5));
  const e = parseTime(String(end).slice(0, 5));
  if (!s || !e) return false;
  const overnight = isOvernightShift(s, e);
  if (!overnight && e <= s) return false;
  const h = hoursBetween(s, e, overnight);
  return h !== null && h >= 0;
}

/** True when an entry has valid start + end and may be written to the DB. */
export function canPersistTimeEntry(startTime: string, endTime: string): boolean {
  return isPersistableTimePair(startTime, endTime);
}

async function checkOverlap(
  employeeId: string,
  entryDate: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<string | null> {
  const overnight = isOvernightShift(startTime, endTime);
  const range = toRange(startTime, endTime, overnight);
  if (!range) return "Invalid time range.";

  const supabase = createClient();
  const { data: siblings } = await supabase
    .from("time_entries")
    .select("id, start_time, end_time")
    .eq("employee_id", employeeId)
    .eq("entry_date", entryDate)
    .not("start_time", "is", null)
    .not("end_time", "is", null);

  for (const s of siblings ?? []) {
    if (excludeId && s.id === excludeId) continue;
    const otherStart = String(s.start_time).slice(0, 5);
    const otherEnd = String(s.end_time).slice(0, 5);
    if (!isPersistableTimePair(otherStart, otherEnd)) continue;
    const otherOvernight = isOvernightShift(otherStart, otherEnd);
    const other = toRange(otherStart, otherEnd, otherOvernight);
    if (other && rangesOverlap(range, other)) {
      return "This entry overlaps another on the same day.";
    }
  }
  return null;
}

export async function saveTimeEntryClient(
  input: SaveTimeEntryInput,
): Promise<SaveTimeEntryResult> {
  const built = buildWriteRow(input);
  if (!("row" in built)) return built;
  const { row, overnight } = built;

  // Compute hours client-side with overnight wrapping — the DB `total_hours`
  // generated column is (end - start)/3600 and goes NEGATIVE for overnight.
  const computedHours =
    row.entry_mode === "decimal_hours"
      ? row.decimal_hours ?? 0
      : durationHours(row.start_time, row.end_time) ?? 0;

  if (row.entry_mode === "time_range" && !overnight) {
    const overlap = await checkOverlap(
      input.employeeId,
      input.entryDate,
      row.start_time,
      row.end_time,
      input.id,
    );
    if (overlap) return { ok: false, message: overlap };
  }

  const supabase = createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("time_entries")
      .update({
        timesheet_id: row.timesheet_id,
        project_id: row.project_id,
        asana_project_id: row.asana_project_id,
        entry_date: row.entry_date,
        start_time: row.start_time,
        end_time: row.end_time,
        entry_mode: row.entry_mode,
        decimal_hours: row.decimal_hours,
        description: row.description,
        billable: row.billable,
      })
      .eq("id", input.id)
      .eq("employee_id", input.employeeId)
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "Couldn't save entry.",
      };
    }

    return {
      ok: true,
      id: data.id,
      total_hours: computedHours,
    };
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({ ...row, org_id: row.org_id as string })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Couldn't create entry.",
    };
  }

  return {
    ok: true,
    id: data.id,
    total_hours: computedHours,
  };
}

export async function deleteTimeEntryClient(
  id: string,
  employeeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("employee_id", employeeId);

  if (error) {
    return { ok: false, message: error.message ?? "Couldn't delete entry." };
  }
  return { ok: true };
}
