"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { cn, formatMoney } from "@/lib/utils";
import {
  approveTimesheet,
  rejectTimesheet,
  type ActionResult,
} from "../actions";

function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} loading={pending}>
      {children}
    </Button>
  );
}

function useResultToast(state: ActionResult | null) {
  const { toast } = useToast();
  const last = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);
}

export function ApprovalControls({
  timesheetId,
  status,
}: {
  timesheetId: string;
  status: string;
  calculatedTotal?: number | null;
  currency?: string | null;
}) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approvedTotal, setApprovedTotal] = useState<number | null>(null);
  const [approvedCurrency, setApprovedCurrency] = useState("USD");

  const [approveState, approveAction] = useFormState(approveTimesheet, null);
  const [rejectState, rejectAction] = useFormState(rejectTimesheet, null);

  useResultToast(rejectState);

  useEffect(() => {
    if (rejectState?.ok) {
      setRejectOpen(false);
      router.refresh();
    }
  }, [rejectState, router]);

  useEffect(() => {
    if (approveState?.ok) {
      if (approveState.calculatedTotal != null) {
        setApprovedTotal(approveState.calculatedTotal);
        setApprovedCurrency(approveState.currency ?? "USD");
      }
      router.refresh();
    }
  }, [approveState, router]);

  if (status !== "submitted" && !approvedTotal) return null;

  if (approvedTotal !== null) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="mb-4 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-6 py-5"
      >
        <p className="text-sm font-medium text-[var(--accent-strong)]">
          Timesheet approved
        </p>
        <p className="mt-1 tnum text-2xl font-semibold text-ink">
          {formatMoney(approvedTotal, approvedCurrency)}
        </p>
      </motion.div>
    );
  }

  if (status !== "submitted") return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border bg-surface px-6 py-4">
      <span className="text-sm text-muted">Review this submission:</span>
      <form action={approveAction}>
        <input type="hidden" name="id" value={timesheetId} />
        <SubmitButton>Approve</SubmitButton>
      </form>
      {!rejectOpen ? (
        <Button variant="ghost" size="sm" onClick={() => setRejectOpen(true)}>
          Reject
        </Button>
      ) : (
        <form action={rejectAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={timesheetId} />
          <input
            name="note"
            required
            maxLength={500}
            placeholder="Reason for rejection (required)"
            className={cn(fieldBase, "h-9 w-72 text-sm")}
            aria-label="Rejection note"
          />
          <SubmitButton variant="danger">Confirm reject</SubmitButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRejectOpen(false)}
          >
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
