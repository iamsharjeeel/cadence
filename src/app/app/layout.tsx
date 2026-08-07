import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/AppShell";
import { runOnboarding } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
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

  if (ctx.realProfile.status === "pending") {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) redirect("/login");
    const updated = await runOnboarding(user.id, user.email);
    if (updated?.status !== "active") redirect("/login?error=session");
    redirect(
      updated.onboarding_complete ? "/app/dashboard" : "/app/onboarding",
    );
  }

  if (ctx.realProfile.status !== "active") {
    redirect("/login");
  }

  const navContext = navContextFor(ctx);

  const inOrg = !ctx.isSuperadmin && ctx.activeOrg;
  const canCreateOrg =
    ctx.isSuperadmin ||
    !ctx.memberships.some((m) => m.role === "owner");
  const switcher = {
    activeOrgId: ctx.activeOrgId,
    isSuperadmin: ctx.isSuperadmin,
    canCreateOrg,
    memberships: ctx.memberships.map((m) => ({
      orgId: m.orgId,
      name: m.name,
      role: m.role,
    })),
    pendingInvites: ctx.pendingInvites.map((i) => ({
      id: i.id,
      orgName: i.orgName,
      role: i.role,
    })),
    currentLabel: inOrg ? ctx.activeOrg!.name : "Personal",
    currentSublabel: ctx.isSuperadmin
      ? "Platform oversight"
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
      orgSettingsOrgId={ctx.activeOrgId}
      canLoadOrgSettings={
        ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin"
      }
    >
      {children}
    </AppShell>
  );
}
