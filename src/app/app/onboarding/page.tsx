import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/Wordmark";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const profile = await requireActiveProfile();

  if (profile.onboarding_complete || profile.status !== "active") {
    redirect("/app/dashboard");
  }

  const db = createAdminClient();
  const { data: steps } = await db
    .from("onboarding_steps")
    .select("step")
    .eq("employee_id", profile.id);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-10">
        <Wordmark />
        <p className="mt-2 text-sm text-muted">Welcome — let&apos;s get you set up.</p>
      </div>
      <OnboardingWizard
        profile={profile}
        completedSteps={(steps ?? []).map((s) => s.step)}
      />
    </div>
  );
}
