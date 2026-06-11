"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/utils";
import type { DocumentType } from "@/lib/documents/types";

export function GenerateDocumentModal({
  timesheetIds,
  periodLabel,
  subtotal,
  currency,
  onClose,
  onSuccess,
}: {
  timesheetIds: string[];
  periodLabel: string;
  subtotal: number;
  currency: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<DocumentType>("pay_advice");
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState("0.10");
  const [busy, setBusy] = useState(false);

  const rate = Number(gstRate) || 0;
  const gst = gstEnabled ? Math.round(subtotal * rate * 100) / 100 : 0;
  const total = Math.round((subtotal + gst) * 100) / 100;

  async function generate() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        type,
        gst_enabled: gstEnabled,
        gst_rate: rate,
      };
      if (timesheetIds.length === 1) {
        payload.timesheet_id = timesheetIds[0];
      } else {
        payload.timesheet_ids = timesheetIds;
      }

      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Generation failed.", "error");
        return;
      }
      toast(json.message ?? "Document generated.", "success");
      onSuccess?.();
      onClose();
    } catch {
      toast("Generation failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-[var(--radius)] border bg-surface p-6 shadow-card"
        role="dialog"
        aria-modal
        aria-labelledby="gen-doc-title"
      >
        <h2 id="gen-doc-title" className="text-lg font-semibold tracking-tightest">
          Generate document
        </h2>
        <p className="mt-1 text-sm text-muted">{periodLabel}</p>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Document type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="h-10 rounded-[var(--radius)] border bg-surface px-3 text-sm"
            >
              <option value="pay_advice">Pay Advice</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={(e) => setGstEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Include GST / VAT
          </label>

          {gstEnabled && (
            <Input
              label="GST rate (decimal)"
              value={gstRate}
              onChange={(e) => setGstRate(e.target.value)}
              placeholder="0.10"
            />
          )}

          <div className="rounded-[var(--radius)] border bg-[var(--accent-soft)]/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="tnum font-medium">
                {formatMoney(subtotal, currency)}
              </span>
            </div>
            {gstEnabled && (
              <div className="mt-2 flex justify-between">
                <span className="text-muted">GST</span>
                <span className="tnum font-medium">
                  {formatMoney(gst, currency)}
                </span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t pt-2">
              <span className="font-medium">Total</span>
              <span className="tnum font-semibold">
                {formatMoney(total, currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate & send"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
