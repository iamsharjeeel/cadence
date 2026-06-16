import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/workspace";
import { PlatformMembersAudit } from "./PlatformMembersAudit";
import { OrgTeamView } from "./OrgTeamView";
import { OrganizationTabs } from "./OrganizationTabs";
import { OrgApprovalSettingsTab } from "./OrgApprovalSettingsTab";
import { OrgDeveloperSettings } from "./OrgDeveloperSettings";

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
  const canAccessSettings = isOwner || wsRole === "admin";

  if (tab === "settings" && !canAccessSettings) {
    redirect("/app/employees?tab=members");
  }

  return (
    <div>
      <OrganizationTabs tab={tab} showSettings={canAccessSettings} />
      {tab === "settings" && canAccessSettings ? (
        <div className="space-y-6">
          {isOwner && <OrgApprovalSettingsTab orgId={ctx.activeOrgId} />}
          <OrgDeveloperSettings orgId={ctx.activeOrgId} />
        </div>
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
