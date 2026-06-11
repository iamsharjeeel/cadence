import "server-only";

import type { Profile, Timesheet } from "@/types/db";
import { createAdminClient } from "@/lib/supabase/admin";

export async function authorizeTimesheetForDocument(
  actor: Profile,
  timesheetId: string,
): Promise<
  | { ok: true; timesheet: Timesheet }
  | { ok: false; status: number; message: string }
> {
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("*")
    .eq("id", timesheetId)
    .single();

  if (!ts) return { ok: false, status: 404, message: "Timesheet not found." };
  const timesheet = ts as Timesheet;

  if (timesheet.status !== "approved") {
    return {
      ok: false,
      status: 400,
      message: "Documents can only be generated for approved timesheets.",
    };
  }

  if (actor.role === "employee" && timesheet.employee_id !== actor.id) {
    return { ok: false, status: 403, message: "Forbidden." };
  }
  if (
    actor.role === "admin" &&
    timesheet.org_id !== actor.org_id
  ) {
    return { ok: false, status: 403, message: "Forbidden." };
  }

  return { ok: true, timesheet };
}
