"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  XCircle,
} from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { useNavigation } from "@/components/app/NavigationProvider";
import { DROPDOWN_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/app/app/notifications/actions";

const TYPE_ICONS: Record<string, typeof Bell> = {
  timesheet_submitted: FileText,
  timesheet_approved: CheckCircle2,
  timesheet_rejected: XCircle,
  time_log_reminder: Clock,
  asana_reconnect_required: Link2,
  leave_requested: Calendar,
  leave_approved: CheckCircle2,
  leave_rejected: XCircle,
  official_document_assigned: FileText,
  official_document_signed: CheckCircle2,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function entityHref(n: NotificationRow): string | null {
  if (!n.entity || !n.entity_id) return null;
  if (n.entity === "timesheets") return `/app/timesheets/${n.entity_id}`;
  if (n.entity === "leave_requests") return "/app/leave";
  if (n.entity === "official_documents") return "/app/documents?tab=official";
  if (n.entity === "profile") return "/app/profile#section-connected";
  return null;
}

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const { startNavigation } = useNavigation();

  const load = useCallback(async () => {
    try {
      const result = await fetchNotifications();
      if (result.ok) {
        setItems(result.notifications);
        setUnread(result.unreadCount);
      }
    } catch {
      // Missing table, expired session, or network error — degrade silently.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!cancelled) await load();
    }

    run();
    const id = setInterval(() => {
      if (!cancelled) load();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load, userId]);

  async function handleClick(n: NotificationRow) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
      );
      setUnread((c) => Math.max(0, c - 1));
    }
    const href = entityHref(n);
    if (href) {
      setOpen(false);
      startNavigation();
      router.push(href);
    }
  }

  async function markAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
  }

  const badgeLabel = unread > 9 ? "9+" : String(unread);
  const hasAsanaReconnectUnread = items.some(
    (n) => !n.read && n.type === "asana_reconnect_required",
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border text-muted transition-colors hover:text-ink"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
              hasAsanaReconnectUnread
                ? "border border-[#F06A6A]/40 bg-surface shadow-sm"
                : "bg-[var(--accent)]",
            )}
          >
            {hasAsanaReconnectUnread ? (
              <AsanaIcon size={10} />
            ) : (
              badgeLabel
            )}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-[var(--radius)] border bg-surface shadow-card"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="text-sm font-medium text-ink">Notifications</span>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-[var(--accent-strong)] hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    No notifications yet
                  </p>
                ) : (
                  items.slice(0, 50).map((n, i) => {
                    const Icon =
                      n.type === "asana_reconnect_required"
                        ? AsanaIcon
                        : (TYPE_ICONS[n.type] ?? Bell);
                    const isAsanaIcon = n.type === "asana_reconnect_required";
                    return (
                      <motion.button
                        key={n.id}
                        type="button"
                        onClick={() => handleClick(n)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.12,
                          delay: i < 5 ? i * 0.03 : 0,
                        }}
                        className={cn(
                          "flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-[var(--accent-soft)]/40",
                          !n.read && "border-l-2 border-l-[var(--accent)]",
                          n.read && "opacity-70",
                        )}
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 shrink-0",
                            isAsanaIcon
                              ? "h-4 w-4"
                              : "h-4 w-4 text-[var(--accent-strong)]",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{n.title}</p>
                          {n.body && (
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted">
                            {relativeTime(n.created_at)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
