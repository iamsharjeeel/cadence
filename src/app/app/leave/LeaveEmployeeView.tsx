"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { CountUp } from "@/components/motion/CountUp";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { LeaveType } from "@/types/db";
import type { BalanceWithType, RequestWithMeta } from "@/lib/leave/queries";
import { cancelLeaveRequest } from "./actions";
import { RequestLeaveModal } from "./RequestLeaveModal";

function statusTone(status: string) {
  if (status === "approved") return "text-[var(--accent-strong)]";
  if (status === "rejected") return "text-[var(--danger)]";
  if (status === "pending") return "text-muted";
  return "text-muted";
}

export function LeaveEmployeeView({
  balances,
  requests,
  leaveTypes,
  calendarMonth,
}: {
  balances: BalanceWithType[];
  requests: RequestWithMeta[];
  leaveTypes: LeaveType[];
  calendarMonth: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      const result = await cancelLeaveRequest(id);
      toast(result.message, result.ok ? "success" : "error");
    } finally {
      setCancellingId(null);
    }
  }

  const monthRequests = requests.filter(
    (r) =>
      r.status !== "cancelled" &&
      r.start_date.slice(0, 7) <= calendarMonth &&
      r.end_date.slice(0, 7) >= calendarMonth,
  );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setModalOpen(true)}>
          Request leave
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => {
          const remaining =
            Number(b.allocated_days) -
            Number(b.used_days) -
            Number(b.pending_days);
          return (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ background: b.leave_type.color ?? "#1F8A8A" }}
                  />
                  {b.leave_type.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-xs text-muted">
                <div>
                  <span className="block uppercase tracking-wide">Allocated</span>
                  <CountUp value={Number(b.allocated_days)} decimals={1} />
                </div>
                <div>
                  <span className="block uppercase tracking-wide">Used</span>
                  <CountUp value={Number(b.used_days)} decimals={1} />
                </div>
                <div>
                  <span className="block uppercase tracking-wide">Pending</span>
                  <CountUp value={Number(b.pending_days)} decimals={1} />
                </div>
                <div>
                  <span className="block uppercase tracking-wide">Remaining</span>
                  <CountUp value={remaining} decimals={1} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            Calendar — {calendarMonth}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthRequests.length === 0 ? (
            <p className="text-sm text-muted">No leave this month.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {monthRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 text-sm"
                  style={{ borderLeft: `3px solid ${r.leave_type.color ?? "#1F8A8A"}` }}
                >
                  <span className="pl-3">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)} ·{" "}
                    {r.leave_type.name} ·{" "}
                    <span className={statusTone(r.status)}>{r.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Request history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Dates</TH>
                <TH>Days</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id}>
                  <TD className="text-sm">{r.leave_type.name}</TD>
                  <TD className="tnum text-sm text-muted">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                  </TD>
                  <TD className="tnum text-sm">{r.days_requested}</TD>
                  <TD className={`text-sm capitalize ${statusTone(r.status)}`}>
                    {r.status}
                  </TD>
                  <TD className="text-right">
                    {r.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancel(r.id)}
                        disabled={cancellingId === r.id}
                      >
                        {cancellingId === r.id ? "Cancelling…" : "Cancel"}
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {modalOpen && (
        <RequestLeaveModal
          leaveTypes={leaveTypes.filter((t) => t.is_active)}
          balances={balances}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
