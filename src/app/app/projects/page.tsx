import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { requireActiveProfile } from "@/lib/auth";
import { listProjects } from "./actions";
import { ProjectsManager } from "./ProjectsManager";
import { SuperadminOrgSelect } from "../settings/SuperadminOrgSelect";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureArray } from "@/lib/org-utils";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const profile = await requireActiveProfile();
  const isSuperadmin = profile.role === "superadmin";
  const isManager = profile.role === "admin" || isSuperadmin;
  const orgId = isSuperadmin ? searchParams.org?.trim() : profile.org_id ?? undefined;

  let orgs: { id: string; name: string }[] = [];
  if (isSuperadmin) {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("id, name")
      .order("name");
    orgs = ensureArray(data);
  }

  const projects = await listProjects(orgId);

  return (
    <div>
      <PageHeader
        title="Projects"
        description={
          isManager
            ? "Org-wide and personal projects for time tracking."
            : "Your personal projects and org-wide assignments."
        }
      />
      {isSuperadmin && (
        <div className="mb-6 max-w-md">
          <Suspense fallback={null}>
            <SuperadminOrgSelect orgs={orgs} selectedOrgId={orgId ?? ""} />
          </Suspense>
        </div>
      )}
      <ProjectsManager projects={projects} isManager={isManager} orgId={orgId} />
    </div>
  );
}
