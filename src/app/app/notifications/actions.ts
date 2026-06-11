"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
};

export type NotificationActionResult =
  | { ok: true; notifications?: NotificationRow[]; unreadCount?: number }
  | { ok: false; message: string };

export async function fetchNotifications(): Promise<
  NotificationActionResult & {
    notifications: NotificationRow[];
    unreadCount: number;
  }
> {
  const profile = await requireActiveProfile();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity, entity_id, read, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return {
      ok: false,
      message: "Couldn't load notifications.",
      notifications: [],
      unreadCount: 0,
    };
  }

  const notifications = (data ?? []) as NotificationRow[];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return { ok: true, notifications, unreadCount };
}

export async function markNotificationRead(
  id: string,
): Promise<NotificationActionResult> {
  const profile = await requireActiveProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) return { ok: false, message: "Couldn't mark notification read." };
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const profile = await requireActiveProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", profile.id)
    .eq("read", false);

  if (error) {
    return { ok: false, message: "Couldn't mark notifications read." };
  }
  revalidatePath("/app");
  return { ok: true };
}
