import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminDashboard } from "@/lib/dashboard/queries";
import { AdminDashboardView } from "@/app/app/dashboard/AdminDashboardView";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const db = createAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("slug", params.slug)
    .single();
  return { title: org ? `${org.name} dashboard` : "Organization dashboard" };
}

export default async function OrgDashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name, slug, logo_url")
    .eq("slug", params.slug)
    .single();
  if (!org) notFound();

  if (profile.role === "admin" && profile.org_id !== org.id) {
    redirect("/app/dashboard");
  }
  if (profile.role === "employee") {
    redirect("/app/dashboard");
  }
  if (profile.role !== "superadmin" && profile.role !== "admin") {
    redirect("/app/dashboard");
  }

  const data = await getAdminDashboard(org.id);

  return (
    <AdminDashboardView
      data={data}
      title={`${org.name} dashboard`}
      description="Approved hours and payroll estimates for this month."
      orgName={org.name}
      orgLogoUrl={org.logo_url}
      showSuperadminNav={profile.role === "superadmin"}
      timesheetsFilterHref={`/app/timesheets?status=submitted&org=${org.id}`}
    />
  );
}
