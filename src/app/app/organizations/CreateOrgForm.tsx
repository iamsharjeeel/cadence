"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { PERIOD_CADENCES } from "@/types/db";
import { titleCase } from "@/lib/utils";
import { createOrg, type ActionResult } from "./actions";

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create organization"}
    </Button>
  );
}

export function CreateOrgForm() {
  const [state, action] = useFormState<ActionResult | null, FormData>(
    createOrg,
    null,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const last = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
      if (state.ok) formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          name="name"
          placeholder="Acme Inc."
          required
          maxLength={80}
        />
        <Input
          label="Slug"
          name="slug"
          placeholder="acme"
          hint="Lowercase letters, numbers, hyphens. Auto-generated if blank."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Base currency"
          name="base_currency"
          defaultValue="USD"
          maxLength={3}
          className="uppercase"
        />
        <Select
          label="Default cadence"
          name="default_cadence"
          defaultValue="monthly"
          options={PERIOD_CADENCES.map((c) => ({
            label: titleCase(c),
            value: c,
          }))}
        />
      </div>
      <Input
        label="Allowed domains"
        name="allowed_domains"
        placeholder="acme.com, acme.io"
        hint="Comma or space separated. For reference only — members join via email invites."
      />
      <div>
        <CreateButton />
      </div>
    </form>
  );
}
