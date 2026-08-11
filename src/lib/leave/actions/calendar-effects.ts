import "server-only";

import { pushLeaveToGoogleCalendar } from "@/lib/google-calendar/push-leave";

export function googleCalendarWarningSuffix(
  push: Awaited<ReturnType<typeof pushLeaveToGoogleCalendar>>,
): string {
  if (push.pushed || push.reason === "not_connected") return "";
  return " (Google Calendar sync failed — your leave was still saved.)";
}
