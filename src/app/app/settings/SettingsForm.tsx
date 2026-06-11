"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { PERIOD_CADENCES } from "@/types/db";
import { titleCase } from "@/lib/utils";
import type { Organization } from "@/types/db";
import { updateOwnOrg, type ActionResult } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}

export function SettingsForm({ org }: { org: Organization }) {
  const [state, action] = useFormState<ActionResult | null, FormData>(
    updateOwnOrg,
    null,
  );
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
      <Input
        label="Organization name"
        name="name"
        defaultValue={org.name}
        maxLength={80}
        required
      />
      <Input
        label="Slug"
        value={`/${org.slug}`}
        readOnly
        disabled
        hint="The slug is fixed once an organization is created."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Base currency"
          name="base_currency"
          defaultValue={org.base_currency}
          maxLength={3}
          className="uppercase"
        />
        <Select
          label="Default cadence"
          name="default_cadence"
          defaultValue={org.default_cadence}
          options={PERIOD_CADENCES.map((c) => ({
            label: titleCase(c),
            value: c,
          }))}
        />
      </div>
      <Input
        label="Allowed domains"
        name="allowed_domains"
        defaultValue={org.allowed_domains.join(", ")}
        placeholder="acme.com, acme.io"
        hint="Comma or space separated."
      />
      <Input
        label="Logo URL"
        name="logo_url"
        type="url"
        defaultValue={org.logo_url ?? ""}
        placeholder="https://…"
        hint="Optional. Used in later phases."
      />
      <div>
        <SaveButton />
      </div>
    </form>
  );
}
