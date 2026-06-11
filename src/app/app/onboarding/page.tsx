import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/Wordmark";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OfficialDocument } from "@/types/db";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const profile = await requireActiveProfile();

  if (
    profile.role !== "employee" ||
    profile.onboarding_complete ||
    profile.status !== "active"
  ) {
    redirect("/app/dashboard");
  }

  const db = createAdminClient();
  const [{ data: steps }, { data: docs }] = await Promise.all([
    db
      .from("onboarding_steps")
      .select("step")
      .eq("employee_id", profile.id),
    db
      .from("official_documents")
      .select("id, name, category, file_path, file_type, signing_type, status, org_id, employee_id, uploaded_by, created_at, updated_at")
      .eq("employee_id", profile.id)
      .eq("status", "pending"),
  ]);

  return (
    <div>
      <div className="mb-10">
        <Wordmark />
        <p className="mt-2 text-sm text-muted">Welcome — let&apos;s get you set up.</p>
      </div>
      <OnboardingWizard
        profile={profile}
        completedSteps={(steps ?? []).map((s) => s.step)}
        pendingDocs={(docs ?? []) as OfficialDocument[]}
      />
    </div>
  );
}
