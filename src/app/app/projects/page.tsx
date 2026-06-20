import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { getWorkspaceContext } from "@/lib/workspace";
import { listProjects, getProjectsPageContext } from "./actions";
import { ProjectsManager } from "./ProjectsManager";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await getWorkspaceContext();
  const [{ canCreate, inOrg }, projects] = await Promise.all([
    getProjectsPageContext(),
    listProjects(),
  ]);

  const inOrgWorkspace = Boolean(ctx?.activeOrgId);

  return (
    <div>
      <PageHeader
        title="Projects"
        description={
          inOrgWorkspace
            ? "Organization, personal, and Asana-synced projects for time tracking."
            : "Your personal and Asana-synced projects for time tracking."
        }
      />
      <ProjectsManager
        projects={projects}
        canCreate={canCreate}
        inOrg={inOrg}
      />
    </div>
  );
}
