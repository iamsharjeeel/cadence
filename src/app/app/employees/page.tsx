import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/workspace";
import { PlatformMembersAudit } from "./PlatformMembersAudit";
import { OrgTeamView } from "./OrgTeamView";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  if (ctx.isSuperadmin) {
    return <PlatformMembersAudit />;
  }

  const wsRole = ctx.workspaceRole;
  if (wsRole !== "owner" && wsRole !== "admin") {
    redirect("/app/dashboard");
  }

  if (!ctx.activeOrgId) {
    redirect("/app/dashboard");
  }

  return (
    <OrgTeamView
      orgId={ctx.activeOrgId}
      workspaceRole={wsRole}
      actorId={ctx.realProfile.id}
    />
  );
}
