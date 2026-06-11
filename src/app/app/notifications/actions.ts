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

export async function fetchNotifications(): Promise<{
  ok: boolean;
  notifications: NotificationRow[];
  unreadCount: number;
}> {
  const profile = await requireActiveProfile();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity, entity_id, read, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { ok: false, notifications: [], unreadCount: 0 };
  }

  const notifications = (data ?? []) as NotificationRow[];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return { ok: true, notifications, unreadCount };
}

export async function markNotificationRead(id: string): Promise<void> {
  const profile = await requireActiveProfile();
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", profile.id);
}

export async function markAllNotificationsRead(): Promise<void> {
  const profile = await requireActiveProfile();
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", profile.id)
    .eq("read", false);
  revalidatePath("/app");
}
