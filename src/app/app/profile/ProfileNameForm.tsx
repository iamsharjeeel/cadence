"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateOwnName, type ActionResult } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function ProfileNameForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    updateOwnName,
    null,
  );
  const { toast } = useToast();
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        label="Full name"
        name="full_name"
        defaultValue={defaultName}
        maxLength={80}
        required
        autoComplete="name"
      />
      <Input
        label="Email"
        value={email}
        readOnly
        disabled
        hint="Managed by your Google account."
      />
      <div>
        <SaveButton />
      </div>
    </form>
  );
}
