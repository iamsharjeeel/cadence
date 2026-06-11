"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
} from "@/lib/documents/types";
import {
  resendDocumentEmail,
  updateDocumentStatus,
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

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

export function DocumentStatusSelect({
  id,
  current,
}: {
  id: string;
  current: DocumentStatus;
}) {
  const [state, action] = useFormState(updateDocumentStatus, null);
  useResultToast(state);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 rounded-[var(--radius)] border bg-surface px-2 text-sm"
      >
        {DOCUMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </form>
  );
}

export function ResendEmailButton({ id }: { id: string }) {
  const [state, action] = useFormState(resendDocumentEmail, null);
  useResultToast(state);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton>Re-send</SubmitButton>
    </form>
  );
}

export function DocumentFilters({
  type,
  status,
  employee,
  employees,
  from,
  to,
  isManager,
}: {
  type: string;
  status: string;
  employee: string;
  employees: { id: string; name: string }[];
  from: string;
  to: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  if (!isManager) return null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Type"
        value={type}
        onChange={(e) => setParam("type", e.target.value)}
        className="h-9 w-40 text-sm"
        options={[
          { label: "All types", value: "" },
          { label: "Pay Advice", value: "pay_advice" },
          { label: "Invoice", value: "invoice" },
        ]}
      />
      <Select
        label="Status"
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-9 w-44 text-sm"
        options={[
          { label: "All statuses", value: "" },
          ...DOCUMENT_STATUSES.map((s) => ({
            label: s.replace(/_/g, " "),
            value: s,
          })),
        ]}
      />
      {employees.length > 0 && (
        <Select
          label="Employee"
          value={employee}
          onChange={(e) => setParam("employee", e.target.value)}
          className="h-9 w-52 text-sm"
          options={[
            { label: "All employees", value: "" },
            ...employees.map((e) => ({ label: e.name, value: e.id })),
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
