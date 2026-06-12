import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodForDate, toIsoDate } from "@/lib/time/periods";
import type { PeriodCadence } from "@/types/db";
import { TimeTrackingView } from "../TimeTrackingView";
import { TimeLogReminder } from "../TimeLogReminder";

export const metadata: Metadata = { title: "Log time" };

export default async function LogTimePage() {
  const profile = await requireActiveProfile();

  if (!profile.org_id) {
    return (
      <div>
        <PageHeader
          title="Log time"
          description="Record your hours day by day."
        />
        <EmptyState
          title="No organization assigned"
          description="Your profile needs an organization before you can log time. Contact a platform administrator."
        />
      </div>
    );
  }

  const db = createAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("default_cadence")
    .eq("id", profile.org_id)
    .single();
  const cadence = (org?.default_cadence as PeriodCadence) ?? "monthly";
  const period = periodForDate(toIsoDate(new Date()), cadence);
  const isManager = profile.role === "admin" || profile.role === "superadmin";

  return (
    <div>
      <TimeLogReminder />
      <PageHeader
        title="Log time"
        description="Record your hours day by day, then submit the period for approval."
        action={
          isManager ? (
            <Link href="/app/timesheets">
              <Button variant="ghost" size="sm">
                Back to timesheets
              </Button>
            </Link>
          ) : undefined
        }
      />
      <TimeTrackingView initialPeriod={period} cadence={cadence} />
    </div>
  );
}
