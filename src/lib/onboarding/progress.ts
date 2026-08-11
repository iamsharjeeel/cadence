import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const TRACKED_STEPS = [
  "personal",
  "employment",
  "banking",
  "emergency",
  "documents",
] as const;

export type OnboardingDetail = {
  label: string;
  steps: { step: string; completed_at: string | null }[];
};

export async function getOnboardingDetailsForEmployees(
  employeeIds: string[],
): Promise<Map<string, OnboardingDetail>> {
  if (!employeeIds.length) return new Map();

  const db = createAdminClient();
  const [{ data: profiles }, { data: steps }] = await Promise.all([
    db
      .from("profiles")
      .select("id, onboarding_complete")
      .in("id", employeeIds),
    db
      .from("onboarding_steps")
      .select("employee_id, step, completed_at")
      .in("employee_id", employeeIds),
  ]);

  const completeById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.onboarding_complete]),
  );
  const stepsById = new Map<
    string,
    { step: string; completed_at: string | null }[]
  >();
  for (const row of steps ?? []) {
    const employeeSteps = stepsById.get(row.employee_id) ?? [];
    employeeSteps.push({ step: row.step, completed_at: row.completed_at });
    stepsById.set(row.employee_id, employeeSteps);
  }

  return new Map(
    employeeIds.map((employeeId) => {
      const employeeSteps = stepsById.get(employeeId) ?? [];
      const completed = TRACKED_STEPS.filter((trackedStep) =>
        employeeSteps.some(
          (step) =>
            step.step === trackedStep && step.completed_at !== null,
        ),
      ).length;
      return [
        employeeId,
        {
          label: completeById.get(employeeId)
            ? "Complete"
            : `${completed}/${TRACKED_STEPS.length} steps`,
          steps: employeeSteps,
        },
      ];
    }),
  );
}

export async function getOnboardingProgress(
  employeeId: string,
): Promise<{ completed: number; total: number; label: string }> {
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("onboarding_complete, role")
    .eq("id", employeeId)
    .single();

  if (profile?.onboarding_complete) {
    return { completed: TRACKED_STEPS.length, total: TRACKED_STEPS.length, label: "Complete" };
  }

  const { data: steps } = await db
    .from("onboarding_steps")
    .select("step")
    .eq("employee_id", employeeId)
    .not("completed_at", "is", null);

  const done = new Set((steps ?? []).map((s) => s.step));
  const completed = TRACKED_STEPS.filter((s) => done.has(s)).length;
  return {
    completed,
    total: TRACKED_STEPS.length,
    label: `${completed}/${TRACKED_STEPS.length} steps`,
  };
}

export async function getOnboardingStepsDetail(employeeId: string) {
  const db = createAdminClient();
  const { data: steps } = await db
    .from("onboarding_steps")
    .select("step, completed_at")
    .eq("employee_id", employeeId);
  return steps ?? [];
}
