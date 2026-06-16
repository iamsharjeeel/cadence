"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAsanaConnection } from "@/lib/asana/connection";
import {
  addDays,
  mondayOfWeek,
  toIsoDate,
} from "@/lib/time/periods";
import { ensureTimesheetForWeekForProfile, loadAsanaImportedProjects } from "@/lib/time/get-time-tracking-data";
import type { OrgSettings } from "@/types/org-settings";

export type TimerSaveSegment = {
  entryDate: string;
  startTime: string;
  endTime: string;
  overnight?: boolean;
};

export type TimerSavePayload = {
  segments: TimerSaveSegment[];
  projectId?: string | null;
  description?: string;
  billable?: boolean;
};

export type TimerSaveResult = { ok: boolean; message: string; ids?: string[] };

async function resolveEntryStatus(
  orgId: string | null,
): Promise<"pending_approval" | "approved"> {
  if (!orgId) return "approved";

  const supabase = createClient();
  const { data } = await supabase.rpc("get_or_create_org_settings", {
    p_org_id: orgId,
  });
  const settings = data as OrgSettings | null;
  if (settings?.approvals_timesheets) return "pending_approval";
  return "approved";
}

/** Persist timer segments as time_entries (midnight splits handled client-side). */
export async function saveTimerEntries(
  payload: TimerSavePayload,
): Promise<TimerSaveResult> {
  const profile = await requireActiveProfile();
  const orgId = profile.org_id ?? null;

  if (!payload.segments?.length) {
    return { ok: false, message: "No time to save." };
  }

  const status = await resolveEntryStatus(orgId);
  const db = createAdminClient();
  const ids: string[] = [];

  for (const seg of payload.segments) {
    const weekMonday = mondayOfWeek(seg.entryDate);
    const tsResult = await ensureTimesheetForWeekForProfile(profile, weekMonday);
    if (!tsResult.ok) {
      return { ok: false, message: tsResult.message };
    }

    const projectId =
      payload.projectId && payload.projectId.trim() !== ""
        ? payload.projectId
        : null;

    const { data, error } = await db
      .from("time_entries")
      .insert({
        org_id: orgId,
        employee_id: profile.id,
        timesheet_id: tsResult.timesheetId,
        project_id: projectId,
        entry_date: seg.entryDate,
        start_time: seg.startTime,
        end_time: seg.endTime,
        entry_mode: "time_range",
        description: payload.description?.trim() || null,
        billable: payload.billable ?? true,
        status,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "Couldn't save timer entry.",
      };
    }
    ids.push(data.id);
  }

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/reports");
  revalidatePath("/app/dashboard");

  return {
    ok: true,
    message:
      status === "pending_approval"
        ? "Time saved — pending manager approval."
        : "Time saved.",
    ids,
  };
}

/** ISO date helpers for midnight split (client may also split; exported for tests). */
export function splitTimerAtMidnight(
  startedAt: Date,
  endedAt: Date,
): TimerSaveSegment[] {
  const startDate = toIsoDate(startedAt);
  const endDate = toIsoDate(endedAt);

  if (startDate === endDate) {
    return [
      {
        entryDate: startDate,
        startTime: formatTime(startedAt),
        endTime: formatTime(endedAt),
      },
    ];
  }

  const endOfDay = new Date(startedAt);
  endOfDay.setHours(23, 59, 59, 0);

  const startOfNext = new Date(endedAt);
  startOfNext.setHours(0, 0, 0, 0);

  return [
    {
      entryDate: startDate,
      startTime: formatTime(startedAt),
      endTime: "23:59",
    },
    {
      entryDate: endDate,
      startTime: "00:00",
      endTime: formatTime(endedAt),
    },
  ];
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Fetch projects for timer widget (same as time entry picker). */
export async function fetchTimerProjects() {
  const profile = await requireActiveProfile();
  const { fetchProjectsForTimeEntry } = await import(
    "@/app/app/projects/actions"
  );
  const projects = await fetchProjectsForTimeEntry(
    profile.org_id ?? null,
    profile.id,
  );
  const hasAsana = await hasAsanaConnection(profile.id);
  const asanaProjects = hasAsana
    ? await loadAsanaImportedProjects(profile.id)
    : [];
  return {
    projects,
    hasAsana,
    asanaProjects,
  };
}
