"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useOrgSettings } from "@/contexts/OrgSettingsContext";
import { updateOrgApprovalSettings } from "@/lib/org-settings/actions";
import type { ApproverScope } from "@/types/org-settings";
import { cn } from "@/lib/utils";

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
          checked ? "bg-[var(--accent)]" : "bg-[var(--line)]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

export function OrgApprovalSettingsTab({ orgId }: { orgId: string }) {
  const { settings, loading, refresh } = useOrgSettings();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [timesheets, setTimesheets] = useState(false);
  const [leave, setLeave] = useState(false);
  const [expenses, setExpenses] = useState(false);
  const [approverScope, setApproverScope] =
    useState<ApproverScope>("owner_only");

  useEffect(() => {
    if (!settings) return;
    setTimesheets(settings.approvals_timesheets);
    setLeave(settings.approvals_leave);
    setExpenses(settings.approvals_expenses);
    setApproverScope(settings.approver_scope);
  }, [settings]);

  const anyApproval = timesheets || leave || expenses;

  function save() {
    startTransition(async () => {
      const result = await updateOrgApprovalSettings({
        orgId,
        approvals_timesheets: timesheets,
        approvals_leave: leave,
        approvals_expenses: expenses,
        approver_scope: approverScope,
      });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) await refresh();
    });
  }

  if (loading && !settings) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted">
          Loading settings…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Approval settings</CardTitle>
          <CardDescription>
            Control which submissions require manager approval before they are
            finalized.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <ToggleRow
            label="Timesheets"
            description="Require manager approval before timesheets are submitted"
            checked={timesheets}
            disabled={pending}
            onChange={setTimesheets}
          />
          <ToggleRow
            label="Leave"
            description="Require approval for leave requests"
            checked={leave}
            disabled={pending}
            onChange={setLeave}
          />
          <ToggleRow
            label="Expenses"
            description="Require approval for expense submissions"
            checked={expenses}
            disabled={pending}
            onChange={setExpenses}
          />
        </CardContent>
      </Card>

      {anyApproval && (
        <Card>
          <CardHeader>
            <CardTitle>Approver settings</CardTitle>
            <CardDescription>
              Choose who receives approval tasks when any approval toggle is
              enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-colors hover:bg-surface-low">
              <input
                type="radio"
                name="approver_scope"
                className="mt-1"
                checked={approverScope === "owner_only"}
                disabled={pending}
                onChange={() => setApproverScope("owner_only")}
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  Owner only
                </span>
                <span className="mt-1 block text-sm text-muted">
                  Only the organization owner receives approval tasks
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-colors hover:bg-surface-low">
              <input
                type="radio"
                name="approver_scope"
                className="mt-1"
                checked={approverScope === "owner_and_managers"}
                disabled={pending}
                onChange={() => setApproverScope("owner_and_managers")}
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  Owner and Managers
                </span>
                <span className="mt-1 block text-sm text-muted">
                  All managers and the owner receive approval tasks
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
