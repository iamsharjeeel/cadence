"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { cn, titleCase } from "@/lib/utils";
import {
  setEmployeeBanking,
  setRate,
  setRole,
  setStatus,
  type ActionResult,
} from "./actions";
import type { RateType, UserRole, UserStatus } from "@/types/db";
import { RATE_TYPES } from "@/types/db";

/** Surfaces a server-action result as a toast, once per change. */
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

export function RoleSelect({
  id,
  current,
  actorRole,
}: {
  id: string;
  current: "owner" | "admin" | "employee";
  actorRole: UserRole;
}) {
  const [state, action] = useFormState(setRole, null);
  useResultToast(state);
  const formRef = useRef<HTMLFormElement>(null);
  const options =
    actorRole === "admin"
      ? [{ value: "employee", label: "Employee" }]
      : [
          { value: "owner", label: "Owner" },
          { value: "admin", label: "Manager" },
          { value: "employee", label: "Employee" },
        ];

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className={cn(fieldBase, "h-9 w-36 text-sm")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}

export function StatusSelect({
  id,
  current,
}: {
  id: string;
  current: "active" | "suspended" | "pending";
}) {
  const [state, action] = useFormState(setStatus, null);
  useResultToast(state);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className={cn(fieldBase, "h-9 w-32 text-sm")}
      >
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="pending">Pending</option>
      </select>
    </form>
  );
}

export function RateEditor({
  id,
  rate,
  rateType,
  currency,
}: {
  id: string;
  rate: number | null;
  rateType: RateType;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(setRate, null);
  useResultToast(state);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit rate
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <Input
        name="rate"
        type="number"
        step="0.01"
        min="0"
        defaultValue={rate ?? ""}
        placeholder="Rate"
        className="h-9 w-24"
        aria-label="Rate"
      />
      <select
        name="rate_type"
        defaultValue={rateType}
        className={cn(fieldBase, "h-9 w-28 text-sm")}
        aria-label="Rate type"
      >
        {RATE_TYPES.map((t) => (
          <option key={t} value={t}>
            {titleCase(t)}
          </option>
        ))}
      </select>
      <Input
        name="currency"
        defaultValue={currency}
        maxLength={3}
        placeholder="USD"
        className="h-9 w-20 uppercase"
        aria-label="Currency"
      />
      <SubmitButton size="sm">Save</SubmitButton>
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

export function BankingEditor({
  id,
  defaults,
  accountMasked,
  bsbMasked,
}: {
  id: string;
  defaults: {
    bank_name: string;
    bank_account_name: string;
    tax_id: string;
    address: string;
    payment_terms_days: number;
  };
  accountMasked: string;
  bsbMasked: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(setEmployeeBanking, null);
  useResultToast(state);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Banking
      </Button>
    );
  }

  return (
    <form action={action} className="flex min-w-[20rem] flex-col gap-2 rounded-[var(--radius-card)] border bg-surface p-3">
      <input type="hidden" name="id" value={id} />
      <Input label="Bank name" name="bank_name" defaultValue={defaults.bank_name} className="h-9 text-sm" />
      <Input label="Account name" name="bank_account_name" defaultValue={defaults.bank_account_name} className="h-9 text-sm" />
      <Input label="Account number" name="bank_account_number" placeholder={accountMasked} className="h-9 text-sm" />
      <Input label="BSB / SWIFT" name="bank_bsb_swift" placeholder={bsbMasked} className="h-9 text-sm" />
      <Input label="Tax ID" name="tax_id" defaultValue={defaults.tax_id} className="h-9 text-sm" />
      <Input label="Address" name="address" defaultValue={defaults.address} className="h-9 text-sm" />
      <Input label="Payment terms (days)" name="payment_terms_days" type="number" defaultValue={String(defaults.payment_terms_days)} className="h-9 text-sm" />
      <div className="flex gap-2">
        <SubmitButton size="sm">Save</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function SubmitButton({
  children,
  size = "md",
}: {
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}
