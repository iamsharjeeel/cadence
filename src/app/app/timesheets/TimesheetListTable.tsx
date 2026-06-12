"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { OvertimeBadge, TimesheetStatusPill } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatMoney } from "@/lib/utils";
import type { TimesheetStatus } from "@/types/db";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { GenerateDocumentModal } from "@/components/documents/GenerateDocumentModal";
import {
  ApproveTimesheetButton,
  RejectTimesheetControl,
} from "./controls";
import { DeleteTimesheetControl } from "./DeleteTimesheetControl";
import { TimesheetStatusActions } from "./TimesheetStatusActions";
import { bulkApproveTimesheets } from "./actions";
import { currentSearchParams } from "@/lib/search-params";
import type { UserRole } from "@/types/db";

export type TimesheetListRow = {
  id: string;
  org_id: string;
  employee_id: string;
  employeeName: string;
  orgName?: string;
  period_start: string;
  period_end: string;
  rowCount: number;
  status: TimesheetStatus;
  created_at: string;
  calculated_total: number | null;
  currency_snapshot: string | null;
  rejection_note: string | null;
  has_overtime: boolean;
  overtime_hours: number;
  resubmit_count: number;
};

type SortKey = "period" | "total" | "submitted";

function canDeleteRow(
  row: TimesheetListRow,
  userId: string,
  role: UserRole,
  userOrgId: string | null,
): boolean {
  if (row.employee_id === userId) return true;
  if ((role === "admin" || role === "owner") && userOrgId && row.org_id === userOrgId) return true;
  if (role === "superadmin") return true;
  return false;
}

export function TimesheetListTable({
  timesheets,
  isManager,
  isSuperadmin,
  currentUserId,
  currentUserRole,
  currentUserOrgId,
  sort,
  dir,
}: {
  timesheets: TimesheetListRow[];
  isManager: boolean;
  isSuperadmin: boolean;
  currentUserId: string;
  currentUserRole: UserRole;
  currentUserOrgId: string | null;
  sort: SortKey;
  dir: "asc" | "desc";
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generateOpen, setGenerateOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const submittedIds = timesheets
    .filter((t) => t.status === "submitted")
    .map((t) => t.id);
  const approvedIds = timesheets
    .filter((t) => t.status === "approved" && t.calculated_total !== null)
    .map((t) => t.id);
  const selectableIds = [...new Set([...submittedIds, ...approvedIds])];
  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selectedSubmitted = timesheets.filter(
    (t) => selected.has(t.id) && t.status === "submitted",
  );
  const selectedApproved = timesheets.filter(
    (t) => selected.has(t.id) && t.status === "approved" && t.calculated_total !== null,
  );

  function toggleAll() {
    if (allSelectableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sortLink(key: SortKey) {
    const next = currentSearchParams(searchParams);
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    next.set("sort", key);
    next.set("dir", nextDir);
    return `${pathname}?${next.toString()}`;
  }

  function sortIndicator(key: SortKey) {
    if (sort !== key) return null;
    return dir === "asc" ? " ↑" : " ↓";
  }

  function bulkApprove() {
    const ids = [...selected].filter((id) =>
      timesheets.some((t) => t.id === id && t.status === "submitted"),
    );
    if (ids.length === 0) {
      toast("Select submitted timesheets to approve.", "error");
      return;
    }
    setBulkPending(true);
    void bulkApproveTimesheets(ids)
      .then((result) => {
        toast(result.message, result.ok ? "success" : "error");
        if (result.ok) {
          setSelected(new Set());
          router.refresh();
        }
      })
      .finally(() => setBulkPending(false));
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
          <span className="text-sm text-muted">
            {selected.size} selected
          </span>
          {isManager && selectedSubmitted.length > 0 && (
            <Button size="sm" onClick={bulkApprove} disabled={bulkPending}>
              {bulkPending ? "Approving…" : "Approve selected"}
            </Button>
          )}
          {selectedApproved.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGenerateOpen(true)}
            >
              Generate documents ({selectedApproved.length})
            </Button>
          )}
        </div>
      )}
      {generateOpen && selectedApproved.length > 0 && (
        <GenerateDocumentModal
          timesheetIds={selectedApproved.map((t) => t.id)}
          periodLabel={`${selectedApproved.length} approved timesheet${selectedApproved.length === 1 ? "" : "s"}`}
          subtotal={selectedApproved.reduce((s, t) => s + (t.calculated_total ?? 0), 0)}
          currency={selectedApproved[0]?.currency_snapshot ?? "USD"}
          onClose={() => setGenerateOpen(false)}
          onSuccess={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}
      <Table>
        <THead>
          <TR>
            <TH className="w-10">
              <input
                type="checkbox"
                checked={allSelectableSelected}
                onChange={toggleAll}
                disabled={selectableIds.length === 0}
                aria-label="Select all timesheets"
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </TH>
            {isManager && <TH>Employee</TH>}
            {isSuperadmin && <TH>Org</TH>}
            <TH>
              <Link
                href={sortLink("period")}
                className="hover:text-[var(--accent-strong)]"
              >
                Period{sortIndicator("period")}
              </Link>
            </TH>
            <TH>Rows</TH>
            <TH>Status</TH>
            {isManager && (
              <TH>
                <Link
                  href={sortLink("total")}
                  className="hover:text-[var(--accent-strong)]"
                >
                  Total{sortIndicator("total")}
                </Link>
              </TH>
            )}
            <TH>
              <Link
                href={sortLink("submitted")}
                className="hover:text-[var(--accent-strong)]"
              >
                Submitted{sortIndicator("submitted")}
              </Link>
            </TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {timesheets.map((t) => (
            <TR key={t.id}>
              <TD>
                {(t.status === "submitted" || t.status === "approved") && (
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                    aria-label={`Select timesheet ${t.period_start}`}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                )}
              </TD>
              {isManager && (
                <TD className="text-sm font-medium text-ink">
                  {t.employeeName}
                </TD>
              )}
              {isSuperadmin && (
                <TD className="text-sm text-muted">{t.orgName ?? "—"}</TD>
              )}
              <TD className="tnum text-sm">
                {formatDate(t.period_start)} – {formatDate(t.period_end)}
              </TD>
              <TD className="tnum text-sm text-muted">{t.rowCount}</TD>
              <TD>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TimesheetStatusPill
                      status={t.status}
                      live={isManager && t.status === "draft"}
                    />
                    {t.has_overtime && t.overtime_hours > 0 && (
                      <OvertimeBadge hours={t.overtime_hours} />
                    )}
                    {t.status === "submitted" && t.resubmit_count > 0 && (
                      <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-strong)]">
                        Resubmitted
                      </span>
                    )}
                  </div>
                  {t.status === "rejected" && t.rejection_note && (
                    <span className="max-w-xs text-xs text-[var(--danger)]">
                      {t.rejection_note}
                    </span>
                  )}
                </div>
              </TD>
              {isManager && (
                <TD className="tnum text-sm">
                  {t.status === "approved" && t.calculated_total !== null
                    ? formatMoney(
                        t.calculated_total,
                        t.currency_snapshot ?? "USD",
                      )
                    : "—"}
                </TD>
              )}
              <TD className="tnum text-sm text-muted">
                {formatDate(t.created_at)}
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-2">
                  {isManager && (
                    <>
                      <ApproveTimesheetButton id={t.id} status={t.status} />
                      <RejectTimesheetControl id={t.id} status={t.status} />
                    </>
                  )}
                  <TimesheetStatusActions
                    id={t.id}
                    status={t.status}
                    periodStart={t.period_start}
                    isOwner={t.employee_id === currentUserId}
                  />
                  {t.status === "approved" && t.calculated_total !== null && (
                    <GenerateDocumentButton
                      timesheetIds={[t.id]}
                      periodLabel={`${formatDate(t.period_start)} – ${formatDate(t.period_end)}`}
                      subtotal={t.calculated_total}
                      currency={t.currency_snapshot ?? "USD"}
                      label="Document"
                      variant="ghost"
                    />
                  )}
                  <Link href={`/app/timesheets/${t.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                  <DeleteTimesheetControl
                    id={t.id}
                    status={t.status}
                    canDelete={canDeleteRow(
                      t,
                      currentUserId,
                      currentUserRole,
                      currentUserOrgId,
                    )}
                  />
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
