"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, fieldBase } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { cn, titleCase } from "@/lib/utils";
import { RATE_TYPES, type Profile } from "@/types/db";
import {
  completeOnboarding,
  saveBanking,
  saveEmergency,
  saveEmployment,
  savePersonal,
  skipStep,
} from "./actions";

const STEP_LABELS = ["Personal", "Employment", "Banking & tax", "Emergency contact"];
const STEP_KEYS = ["personal", "employment", "banking", "emergency"] as const;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function OnboardingWizard({
  profile,
  completedSteps,
}: {
  profile: Profile;
  completedSteps: string[];
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [employmentStartDate, setEmploymentStartDate] = useState(
    profile.start_date ?? "",
  );
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const lastStep = STEP_LABELS.length - 1;
  const isOnboardingRoute =
    pathname.startsWith("/app/onboarding") ||
    pathname.startsWith("/onboarding");

  function showActionToast(result: { ok: boolean; message: string }) {
    if (
      !result.ok &&
      isOnboardingRoute &&
      result.message === "No organization."
    ) {
      return;
    }
    toast(result.message, result.ok ? "success" : "error");
  }

  useEffect(() => {
    if (!done) return;
    router.push("/app/dashboard");
  }, [done, router]);

  async function finish() {
    const result = await completeOnboarding();
    if (result.ok) {
      setDone(true);
    } else {
      showActionToast(result);
    }
  }

  async function runAction(
    action: (fd: FormData) => Promise<{ ok: boolean; message: string }>,
    form: HTMLFormElement,
  ) {
    const fd = new FormData(form);
    setPending(true);
    try {
      const result = await action(fd);
      showActionToast(result);
      if (result.ok) {
        if (step >= lastStep) {
          await finish();
        } else {
          setStep((s) => s + 1);
        }
      }
    } finally {
      setPending(false);
    }
  }

  async function runSkipEmergency() {
    setPending(true);
    try {
      const r = await skipStep("emergency");
      showActionToast(r);
      if (!r.ok) return;
      await finish();
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="rounded-[var(--radius-card)] bg-surface px-8 py-16 text-center shadow-card"
      >
        <h1 className="font-display text-2xl font-semibold tracking-tightest">
          You&apos;re all set.
        </h1>
        <p className="mt-2 text-muted">Redirecting to your dashboard…</p>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const completed =
            completedSteps.includes(STEP_KEYS[i]!) || i < step;
          const active = i === step;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-2.5 w-2.5 items-center justify-center rounded-[var(--radius-chip)] transition-colors",
                  active && "bg-[var(--accent-mid)]",
                  completed && !active && "bg-[var(--accent-soft)]",
                  !active && !completed && "bg-[var(--line)]",
                )}
                title={label}
                aria-hidden
              >
                {completed && !active && (
                  <span className="text-[6px] text-[var(--accent)]">✓</span>
                )}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <span className="h-px w-6 bg-[var(--line)]" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      <p className="mb-6 text-center text-xs text-muted">
        Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{STEP_LABELS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(savePersonal, e.currentTarget);
              }}
              className="flex flex-col gap-4"
            >
              <Input
                label="Full name"
                name="full_name"
                defaultValue={profile.full_name ?? ""}
              />
              <Input
                label="Address"
                name="address"
                defaultValue={profile.address ?? ""}
              />
              <NavButtons step={step} setStep={setStep} pending={pending} />
            </form>
          )}

          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(saveEmployment, e.currentTarget);
              }}
              className="flex flex-col gap-4"
            >
              <Input
                label="Job title"
                name="job_title"
                defaultValue={profile.job_title ?? ""}
              />
              <DatePicker
                label="Start date"
                name="start_date"
                value={employmentStartDate}
                onChange={setEmploymentStartDate}
                maxDate={todayIso()}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Rate"
                  name="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={profile.rate ?? ""}
                  placeholder="e.g. 75"
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="onboarding-rate-type"
                    className="text-sm font-medium text-ink"
                  >
                    Rate type
                  </label>
                  <select
                    id="onboarding-rate-type"
                    name="rate_type"
                    defaultValue={profile.rate_type ?? "hourly"}
                    className={cn(fieldBase, "text-sm")}
                  >
                    {RATE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {titleCase(t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted">
                Every field is optional — you can complete or change these later
                from your profile.
              </p>
              <NavButtons step={step} setStep={setStep} pending={pending} />
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(saveBanking, e.currentTarget);
              }}
              className="flex flex-col gap-4"
            >
              <Input label="Bank name" name="bank_name" defaultValue={profile.bank_name ?? ""} />
              <Input label="Account name" name="bank_account_name" defaultValue={profile.bank_account_name ?? ""} />
              <Input label="Account number" name="bank_account_number" />
              <Input label="BSB / SWIFT" name="bank_bsb_swift" />
              <Input label="Tax ID" name="tax_id" defaultValue={profile.tax_id ?? ""} />
              <Input label="Payment terms (days)" name="payment_terms_days" type="number" defaultValue={String(profile.payment_terms_days ?? 14)} />
              <NavButtons step={step} setStep={setStep} pending={pending} />
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(saveEmergency, e.currentTarget);
              }}
              className="flex flex-col gap-4"
            >
              <Input label="Contact name" name="emergency_name" defaultValue={profile.emergency_name ?? ""} />
              <Input label="Phone" name="emergency_phone" defaultValue={profile.emergency_phone ?? ""} />
              <Input label="Relationship" name="emergency_relation" defaultValue={profile.emergency_relation ?? ""} />
              <NavButtons
                step={step}
                setStep={setStep}
                pending={pending}
                skippable
                onSkip={runSkipEmergency}
                continueLabel="Finish"
              />
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NavButtons({
  step,
  setStep,
  pending,
  skippable,
  onSkip,
  continueLabel = "Continue",
}: {
  step: number;
  setStep: (n: number) => void;
  pending: boolean;
  skippable?: boolean;
  onSkip?: () => void;
  continueLabel?: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {step > 0 && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(step - 1)}
          disabled={pending}
        >
          Back
        </Button>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : continueLabel}
      </Button>
      {skippable && onSkip && (
        <Button type="button" variant="ghost" onClick={onSkip} disabled={pending}>
          Skip for now
        </Button>
      )}
    </div>
  );
}
