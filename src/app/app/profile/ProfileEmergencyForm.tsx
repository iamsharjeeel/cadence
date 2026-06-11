"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateOwnEmergency, type ActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {pending ? "Saving…" : "Save emergency contact"}
    </Button>
  );
}

export function ProfileEmergencyForm({
  defaults,
}: {
  defaults: {
    emergency_name: string;
    emergency_phone: string;
    emergency_relation: string;
  };
}) {
  const [state, action] = useFormState(updateOwnEmergency, null);
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
        label="Contact name"
        name="emergency_name"
        defaultValue={defaults.emergency_name}
      />
      <Input
        label="Phone"
        name="emergency_phone"
        defaultValue={defaults.emergency_phone}
      />
      <Input
        label="Relationship"
        name="emergency_relation"
        defaultValue={defaults.emergency_relation}
      />
      <SubmitButton />
    </form>
  );
}
