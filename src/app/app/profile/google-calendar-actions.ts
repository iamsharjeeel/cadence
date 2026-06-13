"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveProfile } from "@/lib/auth";
import {
  deleteGCalConnection,
  getGCalConnection,
  revokeGCalToken,
} from "@/lib/google-calendar/connection";
import { decryptGCalToken } from "@/lib/google-calendar/crypto";
import { listUserCalendars } from "@/lib/google-calendar/api";
import {
  GCAL_RECONNECT_REQUIRED,
  isGCalReconnectRequiredError,
} from "@/lib/google-calendar/errors";
import {
  getUpcomingSyncedEvents,
  refreshSingleEvent,
  syncGCalEvents,
  type GoogleCalendarEventWithMeta,
} from "@/lib/google-calendar/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type GCalActionResult = {
  ok: boolean;
  message: string;
  needsReconnect?: boolean;
};

export type GCalCalendarOption = {
  id: string;
  summary: string;
  primary?: boolean;
  isSynced: boolean;
};

function gcalActionError(err: unknown): GCalActionResult {
  if (isGCalReconnectRequiredError(err)) {
    return {
      ok: false,
      message: "Reconnect Google Calendar to continue.",
      needsReconnect: true,
    };
  }
  return {
    ok: false,
    message:
      err instanceof Error ? err.message : "Google Calendar request failed.",
  };
}

export async function connectGoogleCalendar(): Promise<void> {
  await requireActiveProfile();
  redirect("/api/google-calendar/connect");
}

export async function disconnectGoogleCalendar(): Promise<GCalActionResult> {
  const profile = await requireActiveProfile();

  try {
    const connection = await getGCalConnection(profile.id);
    if (connection) {
      const accessToken = decryptGCalToken(connection.access_token_enc);
      if (accessToken) {
        await revokeGCalToken(accessToken).catch((err) => {
          console.error("[gcal] revoke failed (continuing):", err);
        });
      }
    }

    await deleteGCalConnection(profile.id);
    revalidatePath("/app/profile");
    revalidatePath("/app/leave");
    revalidatePath("/app/timesheets/log");
    return { ok: true, message: "Google Calendar disconnected." };
  } catch (err) {
    console.error("[gcal] disconnect failed:", err);
    return gcalActionError(err);
  }
}

export async function fetchUserCalendars(): Promise<
  GCalActionResult & { calendars?: GCalCalendarOption[]; email?: string | null }
> {
  const profile = await requireActiveProfile();

  try {
    const [remote, selectedRows, connection] = await Promise.all([
      listUserCalendars(profile.id),
      loadSelectedCalendars(profile.id),
      getGCalConnection(profile.id),
    ]);

    const syncedIds = new Map(
      selectedRows.map((r) => [r.calendar_id, r.is_synced]),
    );

    // The primary calendar id is the account email. Backfill the stored
    // google_email when missing (legacy connections from before the email
    // scope was requested) so the profile tile shows the real address.
    let email = connection?.google_email ?? null;
    const primaryEmail = remote.find((c) => c.primary)?.id ?? null;
    if (!email && primaryEmail) {
      email = primaryEmail;
      const db = createAdminClient();
      const { error } = await db
        .from("google_calendar_connections")
        .update({ google_email: primaryEmail, updated_at: new Date().toISOString() })
        .eq("user_id", profile.id);
      if (error) {
        console.error("[gcal] backfill google_email failed:", error.message);
      } else {
        revalidatePath("/app/profile");
      }
    }

    return {
      ok: true,
      message: "Calendars loaded.",
      email,
      calendars: remote.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
        isSynced: syncedIds.get(cal.id) ?? false,
      })),
    };
  } catch (err) {
    console.error("[gcal] fetch calendars failed:", err);
    return gcalActionError(err);
  }
}

export async function saveSelectedCalendars(
  calendarIds: string[],
): Promise<GCalActionResult> {
  const profile = await requireActiveProfile();

  if (!calendarIds.length) {
    return { ok: false, message: "Select at least one calendar." };
  }

  try {
    const remote = await listUserCalendars(profile.id);
    const selected = remote.filter((c) => calendarIds.includes(c.id));

    if (!selected.length) {
      return { ok: false, message: "No matching calendars found." };
    }

    const db = createAdminClient();

    const { error: clearErr } = await db
      .from("google_selected_calendars")
      .delete()
      .eq("user_id", profile.id);

    if (clearErr) {
      console.error("[gcal] clear selected calendars failed:", clearErr.message);
      return { ok: false, message: "Couldn't update calendar selection." };
    }

    const rows = selected.map((cal) => ({
      user_id: profile.id,
      calendar_id: cal.id,
      calendar_name: cal.summary,
      is_synced: true,
    }));

    const { error } = await db.from("google_selected_calendars").insert(rows);

    if (error) {
      console.error("[gcal] save selected calendars failed:", error.message);
      return { ok: false, message: "Couldn't save calendar selection." };
    }

    revalidatePath("/app/profile");
    revalidatePath("/app/leave");
    revalidatePath("/app/timesheets/log");
    return {
      ok: true,
      message: `Saved ${selected.length} calendar${selected.length === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    console.error("[gcal] save calendars failed:", err);
    return gcalActionError(err);
  }
}

export async function upsertCalendarSyncState(
  calendarId: string,
  calendarName: string,
  isSynced: boolean,
): Promise<GCalActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { error } = await db.from("google_selected_calendars").upsert(
    {
      user_id: profile.id,
      calendar_id: calendarId,
      calendar_name: calendarName,
      is_synced: isSynced,
    },
    { onConflict: "user_id,calendar_id" },
  );

  if (error) {
    console.error("[gcal] upsert calendar sync failed:", error.message);
    return { ok: false, message: "Couldn't update calendar sync." };
  }

  revalidatePath("/app/profile");
  revalidatePath("/app/leave");
  revalidatePath("/app/timesheets/log");
  return { ok: true, message: isSynced ? "Calendar enabled." : "Calendar paused." };
}

export async function syncAllEvents(): Promise<
  GCalActionResult & { synced?: number }
> {
  const profile = await requireActiveProfile();

  try {
    const synced = await syncGCalEvents(profile.id);
    revalidatePath("/app/profile");
    revalidatePath("/app/leave");
    revalidatePath("/app/timesheets/log");
    return {
      ok: true,
      message: `Synced ${synced} event${synced === 1 ? "" : "s"}.`,
      synced,
    };
  } catch (err) {
    console.error("[gcal] sync all failed:", err);
    if (isGCalReconnectRequiredError(err)) {
      return {
        ok: false,
        message: GCAL_RECONNECT_REQUIRED,
        needsReconnect: true,
      };
    }
    return gcalActionError(err);
  }
}

export async function refreshEventDetails(
  googleEventId: string,
): Promise<GCalActionResult & { event?: GoogleCalendarEventWithMeta }> {
  const profile = await requireActiveProfile();

  try {
    const event = await refreshSingleEvent(profile.id, googleEventId);
    if (!event) {
      return { ok: false, message: "Event not found." };
    }

    revalidatePath("/app/profile");
    revalidatePath("/app/leave");
    revalidatePath("/app/timesheets/log");
    return { ok: true, message: "Event refreshed.", event };
  } catch (err) {
    console.error("[gcal] refresh event failed:", err);
    return gcalActionError(err);
  }
}

export async function loadManageModalEvents(): Promise<
  GCalActionResult & { events?: GoogleCalendarEventWithMeta[] }
> {
  const profile = await requireActiveProfile();

  try {
    const events = await getUpcomingSyncedEvents(profile.id, 7, 20);
    return { ok: true, message: "Events loaded.", events };
  } catch (err) {
    console.error("[gcal] load manage events failed:", err);
    return gcalActionError(err);
  }
}

async function loadSelectedCalendars(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("google_selected_calendars")
    .select("calendar_id, calendar_name, is_synced")
    .eq("user_id", userId);

  if (error) {
    console.error("[gcal] selected calendars load failed:", error.message);
    return [];
  }
  return data ?? [];
}
