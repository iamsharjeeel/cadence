import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "suspended") {
    redirect("/login?error=suspended");
  }

  let orgName: string | null = null;
  let orgLogoUrl: string | null = null;
  if (profile.org_id) {
    const supabase = createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url")
      .eq("id", profile.org_id)
      .single();
    orgName = org?.name ?? null;
    orgLogoUrl = org?.logo_url ?? null;
  }

  return (
    <AppShell profile={profile} orgName={orgName} orgLogoUrl={orgLogoUrl}>
      {children}
    </AppShell>
  );
}
