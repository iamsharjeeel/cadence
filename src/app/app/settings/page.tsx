import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getWorkspaceContext } from "@/lib/workspace";
import { SettingsContent } from "./SettingsContent";

export const metadata: Metadata = { title: "Settings" };

function parseParams(searchParams: { tab?: string; org?: string }) {
  return {
    tab: searchParams.tab?.trim() || "general",
    org: searchParams.org?.trim() ?? "",
  };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; org?: string };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const canAccess =
    ctx.isSuperadmin ||
    (Boolean(ctx.activeOrgId) &&
      (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin"));
  if (!canAccess) redirect("/app/dashboard");

  return (
    <div>
      <PageHeader
        title="Organization settings"
        description="Manage your organization's identity, leave types, and domains."
      />
      <Suspense fallback={<CardSkeleton bars={6} />}>
        <SettingsContent filters={parseParams(searchParams)} />
      </Suspense>
    </div>
  );
}
