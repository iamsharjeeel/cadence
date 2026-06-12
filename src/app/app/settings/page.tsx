import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { requireRole } from "@/lib/auth";
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
  await requireRole(["admin", "owner", "superadmin"]);

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
