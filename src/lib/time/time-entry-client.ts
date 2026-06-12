"use client";

import { createClient } from "@/lib/supabase/client";
import {
  hoursBetween,
  isOvernightShift,
  parseTime,
  rangesOverlap,
  toRange,
} from "@/lib/time/validation";

/** Insert/update payload keys allowed by live `time_entries` schema. */
export type TimeEntryWriteRow = {
  org_id: string;
  employee_id: string;
  timesheet_id: string;
  project_id: string | null;
  entry_date: string;
  start_time: string;
  end_time: string;
  description: string | null;
  billable: boolean;
};

export type SaveTimeEntryInput = {
  id?: string;
  orgId: string;
  employeeId: string;
  timesheetId: string;
  entryDate: string;
  startTime: string;
  endTime: string;
  projectId?: string | null;
  description?: string;
  billable?: boolean;
};

export type SaveTimeEntryResult =
  | { ok: true; id: string; total_hours: number }
  | { ok: false; message: string };

function buildWriteRow(input: SaveTimeEntryInput): TimeEntryWriteRow | SaveTimeEntryResult {
  if (!input.orgId?.trim()) {
    return { ok: false, message: "Missing organization — sign in again." };
  }
  if (!input.employeeId?.trim()) {
    return { ok: false, message: "Missing employee profile — sign in again." };
  }
  if (!input.timesheetId?.trim()) {
    return { ok: false, message: "Timesheet not ready — refresh and try again." };
  }

  const start = parseTime(input.startTime);
  const end = parseTime(input.endTime);
  if (!start) return { ok: false, message: "Start time is required." };
  if (!end) return { ok: false, message: "End time is required." };

  const overnight = isOvernightShift(start, end);
  if (!overnight && end <= start) {
    return { ok: false, message: "End time must be after start time." };
  }

  const projectId =
    input.projectId && String(input.projectId).trim() !== ""
      ? String(input.projectId)
      : null;

  return {
    org_id: input.orgId,
    employee_id: input.employeeId,
    timesheet_id: input.timesheetId,
    project_id: projectId,
    entry_date: input.entryDate,
    start_time: start,
    end_time: end,
    description: input.description?.trim() || null,
    billable: input.billable ?? true,
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
  return h !== null && h > 0;
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
  if (!("org_id" in built)) return built;

  const overlap = await checkOverlap(
    input.employeeId,
    input.entryDate,
    built.start_time,
    built.end_time,
    input.id,
  );
  if (overlap) return { ok: false, message: overlap };

  const supabase = createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("time_entries")
      .update({
        timesheet_id: built.timesheet_id,
        project_id: built.project_id,
        entry_date: built.entry_date,
        start_time: built.start_time,
        end_time: built.end_time,
        description: built.description,
        billable: built.billable,
      })
      .eq("id", input.id)
      .eq("employee_id", input.employeeId)
      .select("id, total_hours")
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
      total_hours: Number(data.total_hours),
    };
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert(built)
    .select("id, total_hours")
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
    total_hours: Number(data.total_hours),
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
