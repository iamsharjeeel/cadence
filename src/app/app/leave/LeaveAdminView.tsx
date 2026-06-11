"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { cn, formatDate } from "@/lib/utils";
import type { RequestWithMeta } from "@/lib/leave/queries";
import { approveLeaveRequest, rejectLeaveRequest } from "./actions";

export function LeaveAdminView({
  pending,
  balances,
}: {
  pending: RequestWithMeta[];
  balances: {
    id: string;
    employee_name: string;
    type_name: string;
    allocated_days: number;
    used_days: number;
    pending_days: number;
    year: number;
  }[];
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No pending requests.</p>
          ) : (
            <ul className="divide-y">
              {pending.map((r) => (
                <li key={r.id} className="px-6 py-4">
                  <p className="text-sm font-medium">{r.employee_name}</p>
                  <p className="text-sm text-muted">
                    {r.leave_type.name} · {formatDate(r.start_date)} –{" "}
                    {formatDate(r.end_date)} · {r.days_requested} day(s)
                  </p>
                  {r.note && (
                    <p className="mt-1 text-xs text-muted">{r.note}</p>
                  )}
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team balances</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Employee</TH>
                <TH>Type</TH>
                <TH>Alloc.</TH>
                <TH>Used</TH>
                <TH>Pend.</TH>
                <TH>Remain</TH>
              </TR>
            </THead>
            <TBody>
              {balances.map((b) => (
                <TR key={b.id}>
                  <TD className="text-sm">{b.employee_name}</TD>
                  <TD className="text-sm text-muted">{b.type_name}</TD>
                  <TD className="tnum text-sm">{b.allocated_days}</TD>
                  <TD className="tnum text-sm">{b.used_days}</TD>
                  <TD className="tnum text-sm">{b.pending_days}</TD>
                  <TD className="tnum text-sm">
                    {Number(b.allocated_days) -
                      Number(b.used_days) -
                      Number(b.pending_days)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
