"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import type { LeaveType } from "@/types/db";
import { ensureArray } from "@/lib/org-utils";
import {
  applyDefaultsToAll,
  upsertLeaveType,
  type ActionResult,
} from "./leave-actions";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

function useToastOnResult(state: ActionResult | null) {
  const { toast } = useToast();
  const last = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);
}

export function LeaveTypesTab({
  types,
  orgId,
}: {
  types: LeaveType[];
  orgId: string;
}) {
  const { toast } = useToast();
  const [state, action] = useFormState(upsertLeaveType, null);
  const [applying, setApplying] = useState(false);
  useToastOnResult(state);

  const year = new Date().getFullYear();

  async function handleApplyDefaults() {
    setApplying(true);
    try {
      const r = await applyDefaultsToAll(year, orgId);
      toast(r.message, r.ok ? "success" : "error");
    } finally {
      setApplying(false);
    }
  }

  const safeTypes = ensureArray(types);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Configure leave types and default allocations for this organization.
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={applying}
          onClick={handleApplyDefaults}
        >
          {applying ? "Applying…" : "Apply defaults to all employees"}
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Category</TH>
            <TH>Default days</TH>
            <TH>Color</TH>
            <TH>Active</TH>
          </TR>
        </THead>
        <TBody>
          {safeTypes.map((t) => (
            <TR key={t.id}>
              <TD className="text-sm font-medium">{t.name}</TD>
              <TD className="text-sm capitalize text-muted">
                {t.category.replace(/_/g, " ")}
              </TD>
              <TD className="tnum text-sm">
                {t.default_days_per_year ?? "—"}
              </TD>
              <TD>
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ background: t.color ?? "#B8862F" }}
                />
              </TD>
              <TD className="text-sm">{t.is_active ? "Yes" : "No"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <form
        action={action}
        className="grid gap-4 rounded-[var(--radius)] border p-5 sm:grid-cols-2"
      >
        <input type="hidden" name="org_id" value={orgId} />
        <h3 className="text-sm font-semibold sm:col-span-2">Add custom type</h3>
        <Input label="Name" name="name" required />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select
            name="category"
            className="h-10 rounded-[var(--radius)] border px-3"
          >
            <option value="custom">Custom</option>
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="public_holiday">Public holiday</option>
          </select>
        </label>
        <Input
          label="Default days per year"
          name="default_days_per_year"
          type="number"
          step="0.5"
        />
        <Input label="Color" name="color" defaultValue="#B8862F" />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Active
        </label>
        <div className="sm:col-span-2">
          <SubmitBtn label="Add leave type" />
        </div>
      </form>
    </div>
  );
}
