import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { requireActiveProfile } from "@/lib/auth";
import { decodeGoogleCalendarPrefill } from "@/lib/google-calendar/prefill";
import { getEventsForDay } from "@/lib/google-calendar/sync";
import { getTimeTrackingDataForProfile } from "@/lib/time/get-time-tracking-data";
import { mondayOfWeek, thisWeekMonday, weekDays } from "@/lib/time/periods";
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
import { TimeTrackingView } from "../TimeTrackingView";
import { TimeLogReminder } from "../TimeLogReminder";

export const metadata: Metadata = {
  title: { absolute: "Log time · Cadence" },
};

export default async function LogTimePage({
  searchParams,
}: {
  searchParams?: { date?: string; prefill?: string };
}) {
  const profile = await requireActiveProfile();

  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const weekMonday = searchParams?.date
    ? mondayOfWeek(searchParams.date)
    : thisWeekMonday();
  const days = weekDays(weekMonday);

  const calendarEventsByDay: Record<string, GoogleCalendarEventWithMeta[]> = {};
  await Promise.all(
    days.map(async (day) => {
      calendarEventsByDay[day.date] = await getEventsForDay(profile.id, day.date);
    }),
  );

  const initialData = await getTimeTrackingDataForProfile(profile, weekMonday);
  const initialPrefill = decodeGoogleCalendarPrefill(searchParams?.prefill);

  return (
    <div>
      <TimeLogReminder />
      <PageHeader
        title="Log time"
        description="Log your hours for the week (Mon–Sun), then submit for approval."
        action={
          isManager ? (
            <Link href="/app/timesheets">
              <Button variant="ghost" size="sm">
                Back to timesheets
              </Button>
            </Link>
          ) : undefined
        }
      />
      <TimeTrackingView
        initialWeekMonday={weekMonday}
        initialData={initialData.ok ? initialData : null}
        calendarEventsByDay={calendarEventsByDay}
        initialPrefill={initialPrefill}
        initialFocusDate={searchParams?.date ?? null}
      />
    </div>
  );
}
