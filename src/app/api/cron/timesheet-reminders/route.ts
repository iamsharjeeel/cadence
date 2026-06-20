import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, toIsoDate } from "@/lib/time/periods";
import { getResendClient, getResendFromEmail } from "@/lib/resend";

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return request.headers.get("x-vercel-cron") === "1";
}

/**
 * Explicit product exception:
 * This is the only scheduled job in Cadence right now. It sends one daily
 * timesheet reminder email (max once/day/user) for periods inside the 3-day
 * pre-end submission window that are still in draft.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = toIsoDate(new Date());
  const windowEnd = addDays(today, 3);
  const dayStartIso = `${today}T00:00:00Z`;

  const { data: candidates } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, period_start, period_end, status")
    .eq("status", "draft")
    .gte("period_end", today)
    .lte("period_end", windowEnd)
    .order("period_end", { ascending: true });

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      reminded: 0,
      skipped: 0,
      reason: "No open periods in reminder window.",
    });
  }

  const userIds = [...new Set(candidates.map((row) => row.employee_id))];
  const [{ data: profiles }, { data: sentToday }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email, status")
      .in("id", userIds)
      .eq("status", "active"),
    db
      .from("notifications")
      .select("user_id")
      .eq("type", "timesheet_submit_email_reminder")
      .gte("created_at", dayStartIso)
      .in("user_id", userIds),
  ]);

  const alreadySent = new Set((sentToday ?? []).map((row) => row.user_id));
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const resend = getResendClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cadence-eta-five.vercel.app";

  let reminded = 0;
  let skipped = 0;

  for (const userId of userIds) {
    if (alreadySent.has(userId)) {
      skipped++;
      continue;
    }
    const profile = profileById.get(userId);
    if (!profile?.email) {
      skipped++;
      continue;
    }
    const pending = candidates
      .filter((row) => row.employee_id === userId)
      .sort((a, b) => a.period_end.localeCompare(b.period_end))[0];
    if (!pending) {
      skipped++;
      continue;
    }

    const { error } = await resend.emails.send({
      from: getResendFromEmail(),
      to: profile.email,
      subject: "Cadence reminder: submit your timesheet",
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color: #14151A; max-width: 560px;">
          <p style="font-size: 18px; font-weight: 600; color: #B8862F;">Cadence</p>
          <p style="font-size: 16px; font-weight: 600; margin: 0 0 12px;">Your submission window is open</p>
          <p style="font-size: 14px; line-height: 1.6; color: #4B5563;">
            Hi ${profile.full_name?.trim() || "there"}, your timesheet period
            <strong>${pending.period_start} – ${pending.period_end}</strong>
            is within the 3-day submission window and is still in draft.
          </p>
          <p style="margin: 20px 0;">
            <a href="${appUrl.replace(/\/$/, "")}/app/timesheets"
               style="display:inline-block;background:#B8862F;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600;">
              Open Timesheets
            </a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[cron/timesheet-reminders] email failed", {
        userId,
        email: profile.email,
        error,
      });
      skipped++;
      continue;
    }

    reminded++;
    await db.from("notifications").insert({
      org_id: pending.org_id as string,
      user_id: userId,
      type: "timesheet_submit_email_reminder",
      title: "Timesheet reminder email sent",
      body: `${pending.period_start} – ${pending.period_end}`,
      entity: "timesheets",
      entity_id: pending.id,
    });
  }

  return NextResponse.json({ ok: true, reminded, skipped });
}
