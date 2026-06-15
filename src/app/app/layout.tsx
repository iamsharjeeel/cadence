import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/AppShell";
import { getWorkspaceContext, navContextFor } from "@/lib/workspace";
import { titleCase } from "@/lib/utils";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (ctx.realProfile.status === "suspended") {
    redirect("/login?error=suspended");
  }

  const navContext = navContextFor(ctx);

  const inOrg = !ctx.isSuperadmin && ctx.activeOrg;
  const switcher = {
    activeOrgId: ctx.activeOrgId,
    isSuperadmin: ctx.isSuperadmin,
    memberships: ctx.memberships.map((m) => ({
      orgId: m.orgId,
      name: m.name,
      role: m.role,
    })),
    currentLabel: inOrg ? ctx.activeOrg!.name : "Personal",
    currentSublabel: ctx.isSuperadmin
      ? "Platform admin"
      : inOrg
        ? titleCase(ctx.workspaceRole!)
        : "Personal workspace",
    currentLogoName: inOrg ? ctx.activeOrg!.name : "Personal",
    currentLogoUrl: inOrg ? ctx.activeOrg!.logoUrl : null,
  };

  return (
    <AppShell
      profile={ctx.effectiveProfile}
      navContext={navContext}
      switcher={switcher}
    >
      {children}
    </AppShell>
  );
}
