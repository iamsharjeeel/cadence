import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveProfile } from "@/lib/auth";
import { thisWeekMonday } from "@/lib/time/periods";
import { TimeTrackingView } from "../TimeTrackingView";
import { TimeLogReminder } from "../TimeLogReminder";

export const metadata: Metadata = {
  title: { absolute: "Log time · Cadence" },
};

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

  const isManager = profile.role === "admin" || profile.role === "superadmin";

  return (
    <div>
      <TimeLogReminder />
      <PageHeader
        title="Log time"
        description="Log your hours for the week (Mon–Sun), then submit for approval."
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
      <TimeTrackingView initialWeekMonday={thisWeekMonday()} />
    </div>
  );
}
