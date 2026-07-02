"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { formatLeaveAmount, type LeaveUnit } from "@/lib/leave/types";
import { cn, formatDate } from "@/lib/utils";
import type { RequestWithMeta } from "@/lib/leave/queries";
import { approveLeaveRequest, rejectLeaveRequest } from "./actions";

export function LeaveAdminView({
  pending,
}: {
  pending: RequestWithMeta[];
}) {
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  async function approve(id: string) {
    setActingId(id);
    try {
      const result = await approveLeaveRequest(id);
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
      const result = await rejectLeaveRequest(id, rejectNote);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setRejectId(null);
        setRejectNote("");
      }
    } finally {
      setActingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending requests</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {pending.length === 0 ? (
          <div className="px-6 py-6">
            <EmptyState
              title="You're all caught up"
              description="No pending leave requests to review."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {pending.map((r) => {
              const unit: LeaveUnit =
                r.leave_type?.unit === "hours" ? "hours" : "days";
              const amountLabel = formatLeaveAmount(
                Number(r.days_requested),
                unit,
              );
              const dateLabel =
                unit === "hours"
                  ? formatDate(r.start_date)
                  : `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`;
              const category = r.leave_type?.name;
              return (
                <li key={r.id} className="px-6 py-4">
                  <p className="text-sm font-medium">{r.employee_name}</p>
                  <p className="text-sm text-muted">
                    {category ? `${category} · ` : ""}
                    {dateLabel} · {amountLabel}
                  </p>
                  {r.note ? (
                    <p className="mt-1 text-xs text-muted">{r.note}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => approve(r.id)}
                      disabled={actingId === r.id}
                    >
                      {actingId === r.id ? "Approving…" : "Approve"}
                    </Button>
                    {rejectId !== r.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRejectId(r.id)}
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
                          onClick={() => reject(r.id)}
                          disabled={actingId === r.id}
                        >
                          {actingId === r.id ? "Rejecting…" : "Confirm"}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
