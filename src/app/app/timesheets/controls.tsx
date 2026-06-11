"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { fieldBase } from "@/components/ui/Input";
import { currentSearchParams } from "@/lib/search-params";
import {
  approveTimesheet,
  rejectTimesheet,
  type ActionResult,
} from "./actions";

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

function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

export function ApproveTimesheetButton({
  id,
  status,
}: {
  id: string;
  status?: string;
}) {
  const [state, action] = useFormState(approveTimesheet, null);
  useResultToast(state);
  if (status && status !== "submitted") return null;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton>Approve</SubmitButton>
    </form>
  );
}

export function RejectTimesheetControl({
  id,
  status,
}: {
  id: string;
  status?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(rejectTimesheet, null);
  useResultToast(state);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (status && status !== "submitted") return null;

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="note"
        required
        maxLength={500}
        placeholder="Reason for rejection"
        className={cn(fieldBase, "h-9 w-56 text-sm")}
        aria-label="Rejection note"
      />
      <SubmitButton variant="danger">Confirm</SubmitButton>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </form>
  );
}

/** Filter bar that drives the list via URL search params. */
export function TimesheetFilters({
  status,
  employee,
  employees,
  from,
  to,
  org,
  orgs,
  isSuperadmin,
}: {
  status: string;
  employee: string;
  employees: { id: string; name: string }[];
  from: string;
  to: string;
  org: string;
  orgs: { id: string; name: string }[];
  isSuperadmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = currentSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Status"
        name="status"
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-9 w-40 text-sm"
        options={[
          { label: "All statuses", value: "" },
          { label: "Draft", value: "draft" },
          { label: "Submitted", value: "submitted" },
          { label: "Approved", value: "approved" },
          { label: "Rejected", value: "rejected" },
        ]}
      />
      {employees.length > 0 && (
        <Select
          label="Employee"
          name="employee"
          value={employee}
          onChange={(e) => setParam("employee", e.target.value)}
          className="h-9 w-52 text-sm"
          options={[
            { label: "All employees", value: "" },
            ...employees.map((e) => ({ label: e.name, value: e.id })),
          ]}
        />
      )}
      {isSuperadmin && orgs.length > 0 && (
        <Select
          label="Organization"
          name="org"
          value={org}
          onChange={(e) => setParam("org", e.target.value)}
          className="h-9 w-52 text-sm"
          options={[
            { label: "All organizations", value: "" },
            ...orgs.map((o) => ({ label: o.name, value: o.id })),
          ]}
        />
      )}
      <Input
        label="From"
        type="date"
        value={from}
        onChange={(e) => setParam("from", e.target.value)}
        className="h-9 w-40 text-sm"
      />
      <Input
        label="To"
        type="date"
        value={to}
        onChange={(e) => setParam("to", e.target.value)}
        className="h-9 w-40 text-sm"
      />
    </div>
  );
}
