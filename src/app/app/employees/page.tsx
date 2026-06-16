import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/workspace";
import { PlatformMembersAudit } from "./PlatformMembersAudit";
import { OrgTeamView } from "./OrgTeamView";
import { OrganizationTabs } from "./OrganizationTabs";
import { OrgApprovalSettingsTab } from "./OrgApprovalSettingsTab";

export const metadata: Metadata = { title: "Organization" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
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

  const tab = searchParams.tab === "settings" ? "settings" : "members";
  const isOwner = wsRole === "owner";

  if (tab === "settings" && !isOwner) {
    redirect("/app/employees?tab=members");
  }

  return (
    <div>
      <OrganizationTabs tab={tab} showSettings={isOwner} />
      {tab === "settings" && isOwner ? (
        <OrgApprovalSettingsTab orgId={ctx.activeOrgId} />
      ) : (
        <OrgTeamView
          orgId={ctx.activeOrgId}
          workspaceRole={wsRole}
          actorId={ctx.realProfile.id}
        />
      )}
    </div>
  );
}
