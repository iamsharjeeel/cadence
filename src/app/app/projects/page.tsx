import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { getWorkspaceContext } from "@/lib/workspace";
import { listProjects, getProjectsPageContext } from "./actions";
import { getMyImportedAsanaProjects } from "../profile/asana-actions";
import { ProjectsManager } from "./ProjectsManager";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await getWorkspaceContext();
  const [{ canCreate, inOrg }, projects, asanaProjects] = await Promise.all([
    getProjectsPageContext(),
    listProjects(),
    getMyImportedAsanaProjects(),
  ]);

  const inOrgWorkspace = Boolean(ctx?.activeOrgId);

  return (
    <div>
      <PageHeader
        title="Projects"
        description={
          inOrgWorkspace
            ? "Organization and personal projects for time tracking."
            : "Your personal projects for time tracking."
        }
      />
      <ProjectsManager
        projects={projects}
        asanaProjects={asanaProjects}
        canCreate={canCreate}
        inOrg={inOrg}
      />
    </div>
  );
}
