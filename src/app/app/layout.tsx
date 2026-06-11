import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { PageTransition } from "@/components/motion/PageTransition";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/pending");

  // Resolve the org name for the sidebar (null for unattached superadmins).
  let orgName: string | null = null;
  if (profile.org_id) {
    const supabase = createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.org_id)
      .single();
    orgName = org?.name ?? null;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar role={profile.role} orgName={orgName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="flex-1 px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
