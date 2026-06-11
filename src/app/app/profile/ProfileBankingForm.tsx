"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useEffect, useRef } from "react";
import { updateOwnBanking, type ActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save banking details"}
    </Button>
  );
}

export function ProfileBankingForm({
  defaults,
  accountMasked,
  bsbMasked,
}: {
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
  const [state, action] = useFormState(updateOwnBanking, null);
  const { toast } = useToast();
  const last = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Bank name"
          name="bank_name"
          defaultValue={defaults.bank_name}
        />
        <Input
          label="Account name"
          name="bank_account_name"
          defaultValue={defaults.bank_account_name}
        />
        <Input
          label="Account number"
          name="bank_account_number"
          placeholder={accountMasked !== "—" ? accountMasked : "Enter account number"}
          autoComplete="off"
        />
        <Input
          label="BSB / SWIFT code"
          name="bank_bsb_swift"
          placeholder={bsbMasked !== "—" ? bsbMasked : "Enter BSB or SWIFT"}
          autoComplete="off"
        />
        <Input label="Tax ID" name="tax_id" defaultValue={defaults.tax_id} />
        <Input
          label="Payment terms (days)"
          name="payment_terms_days"
          type="number"
          min={1}
          max={90}
          defaultValue={String(defaults.payment_terms_days)}
        />
      </div>
      <Input
        label="Address"
        name="address"
        defaultValue={defaults.address}
        placeholder="For invoice header"
      />
      <p className="text-xs text-muted">
        Account number and BSB/SWIFT are encrypted. Only the last 4 digits are shown after saving.
      </p>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
