"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { updateOwnEmployment, type ActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {pending ? "Saving…" : "Save employment details"}
    </Button>
  );
}

export function ProfileEmploymentForm({
  jobTitle,
  startDate,
}: {
  jobTitle: string;
  startDate: string;
}) {
  const [state, action] = useFormState(updateOwnEmployment, null);
  const { toast } = useToast();
  const last = useRef<ActionResult | null>(null);
  const [startDateValue, setStartDateValue] = useState(startDate);

  useEffect(() => {
    setStartDateValue(startDate);
  }, [startDate]);

  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        label="Job title"
        name="job_title"
        defaultValue={jobTitle}
        maxLength={80}
      />
      <DatePicker
        label="Start date"
        name="start_date"
        value={startDateValue}
        onChange={setStartDateValue}
      />
      <SubmitButton />
    </form>
  );
}
