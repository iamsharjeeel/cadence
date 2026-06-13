import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { requireActiveProfile } from "@/lib/auth";
import { getTrendsBundle, type TrendRange } from "@/lib/time/trends";
import { TrendsClient } from "./TrendsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureArray } from "@/lib/org-utils";

export const metadata: Metadata = { title: "Trends" };

const RANGES: TrendRange[] = ["weekly", "fortnightly", "monthly", "6month", "yearly"];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: { range?: string; org?: string };
}) {
  const profile = await requireActiveProfile();
  const range = (RANGES.includes(searchParams.range as TrendRange)
    ? searchParams.range
    : "monthly") as TrendRange;
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const isSuperadmin = profile.role === "superadmin";
  const orgId = isSuperadmin ? searchParams.org?.trim() ?? "" : "";

  let orgs: { id: string; name: string }[] = [];
  if (isSuperadmin) {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("id, name")
      .order("name");
    orgs = ensureArray(data);
  }

  const initialData = await getTrendsBundle(profile, range, orgId || undefined);

  return (
    <div className="bg-background">
      <PageHeader
        title="Trends"
        description="Hours, projects, and patterns over time."
      />

      <TrendsClient
        initialRange={range}
        initialOrgId={orgId}
        initialData={initialData}
        orgs={orgs}
        isManager={isManager}
        isSuperadmin={isSuperadmin}
      />
    </div>
  );
}
