import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const TRACKED_STEPS = [
  "personal",
  "employment",
  "banking",
  "emergency",
  "documents",
] as const;

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
