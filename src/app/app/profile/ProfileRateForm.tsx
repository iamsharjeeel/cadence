"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { cn, titleCase, formatMoney } from "@/lib/utils";
import { updateOwnRate, type ActionResult } from "./actions";
import type { RateType } from "@/types/db";
import { RATE_TYPES } from "@/types/db";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {pending ? "Saving…" : "Save rate"}
    </Button>
  );
}

export function ProfileRateForm({
  rate,
  rateType,
  currency,
}: {
  rate: number | null;
  rateType: RateType;
  currency: string;
}) {
  const [state, action] = useFormState(updateOwnRate, null);
  const { toast } = useToast();
  const last = useRef<ActionResult | null>(null);
  const [editing, setEditing] = useState(rate == null);

  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
      if (state.ok) setEditing(false);
    }
  }, [state, toast]);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="tabular text-sm font-medium text-ink">
          {rate != null ? (
            <>
              {formatMoney(rate, currency)}
              <span className="ml-1 text-muted">· {titleCase(rateType)}</span>
            </>
          ) : (
            <span className="text-muted">Not set</span>
          )}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit rate
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 sm:items-end">
      <div className="flex w-full flex-wrap items-end justify-end gap-2">
        <Input
          name="rate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={rate ?? ""}
          placeholder="Rate"
          className="h-9 w-28"
          aria-label="Hourly rate"
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
      </div>
      <div className="flex gap-2">
        <SubmitButton />
        {rate != null ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
