import "server-only";

import { createAllDayEvent } from "@/lib/google-calendar/api";
import { hasGCalConnection } from "@/lib/google-calendar/connection";

export type LeaveGCalPushInput = {
  userId: string;
  startDate: string;
  endDate: string;
  categoryName?: string | null;
  note?: string | null;
};

export type LeaveGCalPushResult =
  | { pushed: true; eventId: string }
  | { pushed: false; reason: "not_connected" | "failed"; message?: string };

/**
 * Best-effort one-way push of confirmed leave to the user's primary Google
 * Calendar. Never throws — callers treat Cadence as source of truth.
 */
export async function pushLeaveToGoogleCalendar(
  input: LeaveGCalPushInput,
): Promise<LeaveGCalPushResult> {
  const connected = await hasGCalConnection(input.userId);
  if (!connected) {
    return { pushed: false, reason: "not_connected" };
  }

  const label =
    input.note?.trim() ||
    input.categoryName?.trim() ||
    "Time off";
  const summary = `Leave — ${label}`;

  try {
    const event = await createAllDayEvent(input.userId, {
      summary,
      description: input.note?.trim() || undefined,
      startDate: input.startDate,
      endDateInclusive: input.endDate,
    });
    return { pushed: true, eventId: event.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[gcal] leave push failed:", message);
    return { pushed: false, reason: "failed", message };
  }
}
