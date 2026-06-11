"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatMoney } from "@/lib/utils";
import type { TimesheetDocCandidate } from "@/lib/documents/queries";
import { GenerateDocumentModal } from "./GenerateDocumentModal";

export function GenerateFromTimesheetsButton({
  timesheets,
  orgOptions,
  selectedOrgId,
}: {
  timesheets: TimesheetDocCandidate[];
  orgOptions?: { id: string; name: string }[];
  selectedOrgId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setOrg(orgId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (orgId) next.set("org", orgId);
    else next.delete("org");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const selectedRows = useMemo(
    () => timesheets.filter((t) => selected.has(t.id)),
    [timesheets, selected],
  );

  const allSelected =
    timesheets.length > 0 && timesheets.every((t) => selected.has(t.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(timesheets.map((t) => t.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openGenerate() {
    if (selectedRows.length === 0) {
      toast("Select at least one timesheet.", "error");
      return;
    }
    setOpen(false);
    setModalOpen(true);
  }

  if (timesheets.length === 0) {
    return (
      <Button size="sm" variant="secondary" disabled>
        Generate from timesheets
      </Button>
    );
  }

  const subtotal = selectedRows.reduce((s, t) => s + t.calculated_total, 0);
  const currency = selectedRows[0]?.currency_snapshot ?? "USD";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {orgOptions && orgOptions.length > 0 && (
          <select
            value={selectedOrgId ?? ""}
            onChange={(e) => setOrg(e.target.value)}
            className="h-9 rounded-[var(--radius)] border bg-surface px-2 text-sm"
            aria-label="Filter by organization"
          >
            <option value="">All organizations</option>
            {orgOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Generate from timesheets
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex max-h-[min(32rem,90vh)] w-full max-w-lg flex-col rounded-[var(--radius)] border bg-surface shadow-card"
            role="dialog"
            aria-modal
            aria-labelledby="pick-ts-title"
          >
            <div className="border-b px-6 py-5">
              <h2
                id="pick-ts-title"
                className="text-lg font-semibold tracking-tightest"
              >
                Generate from timesheets
              </h2>
              <p className="mt-1 text-sm text-muted">
                Approved timesheets without a document yet ({timesheets.length}).
              </p>
            </div>

            <ul className="flex-1 divide-y overflow-y-auto px-2 py-2">
              {timesheets.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] px-4 py-3 hover:bg-[var(--accent-soft)]/30">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {t.employeeName}
                      </span>
                      <span className="tnum block text-xs text-muted">
                        {formatDate(t.period_start)} –{" "}
                        {formatDate(t.period_end)} ·{" "}
                        {formatMoney(
                          t.calculated_total,
                          t.currency_snapshot ?? "USD",
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Select all
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={openGenerate}
                  disabled={selectedRows.length === 0}
                >
                  Continue ({selectedRows.length})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && selectedRows.length > 0 && (
        <GenerateDocumentModal
          timesheetIds={selectedRows.map((t) => t.id)}
          periodLabel={`${selectedRows.length} approved timesheet${selectedRows.length === 1 ? "" : "s"}`}
          subtotal={subtotal}
          currency={currency}
          onClose={() => {
            setModalOpen(false);
            setSelected(new Set());
          }}
          onSuccess={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}
    </>
  );
}
