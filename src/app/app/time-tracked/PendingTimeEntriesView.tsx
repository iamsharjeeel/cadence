"use client";

import { useState } from "react";

import { GmailIcon } from "@/components/icons/GmailIcon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { PendingTimeEntry } from "@/lib/time/pending-time-entries";
import {
  approveTimeEntries,
  approveTimeEntry,
  rejectTimeEntry,
} from "./actions";

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PendingTimeEntriesView({
  pending,
  emailLinksByEntry = new Map(),
}: {
  pending: PendingTimeEntry[];
  emailLinksByEntry?: Map<
    string,
    Array<{
      linkId: string;
      subject: string | null;
      gmailPermalink: string | null;
    }>
  >;
}) {
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  async function approve(id: string) {
    setActingId(id);
    try {
      const result = await approveTimeEntry(id);
      toast(result.message, result.ok ? "success" : "error");
    } finally {
      setActingId(null);
    }
  }

  async function reject(id: string) {
    if (!rejectNote.trim()) {
      toast("Rejection note required.", "error");
      return;
    }
    setActingId(id);
    try {
      const result = await rejectTimeEntry(id, rejectNote);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setRejectId(null);
        setRejectNote("");
      }
    } finally {
      setActingId(null);
    }
  }

  async function approveSelected() {
    if (selected.size === 0) return;
    setBulkPending(true);
    try {
      const result = await approveTimeEntries([...selected]);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) setSelected(new Set());
    } finally {
      setBulkPending(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Pending time entries</CardTitle>
        {pending.length > 0 && selected.size > 0 ? (
          <Button
            size="sm"
            onClick={approveSelected}
            disabled={bulkPending}
          >
            {bulkPending ? "Approving…" : `Approve selected (${selected.size})`}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {pending.length === 0 ? (
          <div className="px-6 py-6">
            <EmptyState
              title="You're all caught up"
              description="No timer entries waiting for approval."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {pending.map((entry) => (
              <li key={entry.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggleSelected(entry.id)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    aria-label={`Select entry for ${entry.employee_name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{entry.employee_name}</p>
                    <p className="text-sm text-muted">
                      {entry.entry_date} · {formatHours(entry.hours)}
                      {entry.billable ? " · Billable" : " · Non-billable"}
                    </p>
                    {entry.description ? (
                      <p className="mt-1 text-xs text-muted">
                        {entry.description}
                      </p>
                    ) : null}
                    {(emailLinksByEntry.get(entry.id) ?? []).map((link) => (
                      <a
                        key={link.linkId}
                        href={link.gmailPermalink ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-[var(--accent-strong)] hover:underline"
                      >
                        <GmailIcon size={12} />
                        {link.subject || "Email thread"}
                      </a>
                    ))}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => approve(entry.id)}
                        disabled={actingId === entry.id || bulkPending}
                      >
                        {actingId === entry.id ? "Approving…" : "Approve"}
                      </Button>
                      {rejectId !== entry.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectId(entry.id)}
                        >
                          Reject
                        </Button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Rejection note"
                            className={cn(fieldBase, "h-9 w-48 text-sm")}
                          />
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => reject(entry.id)}
                            disabled={actingId === entry.id}
                          >
                            {actingId === entry.id ? "Rejecting…" : "Confirm"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
