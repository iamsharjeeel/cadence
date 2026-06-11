import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { RolePill, StatusPill } from "@/components/ui/Badge";
import { Reveal } from "@/components/motion/Reveal";
import { requireActiveProfile } from "@/lib/auth";
import { titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const ROLE_BLURB: Record<string, string> = {
  superadmin:
    "You're on the platform layer. Create and manage organizations, and oversee everything from Organizations.",
  admin:
    "Manage your organization's people, approve pending members, and set rates from Employees.",
  employee:
    "Your profile is all set. Timesheet submission arrives in a later phase.",
};

export default async function DashboardPage() {
  const profile = await requireActiveProfile();
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${firstName}.`}
        description="Here's your Cadence at a glance. Dashboards and stats land in Phase 3."
      />

      <Reveal className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Role
            </span>
            <RolePill role={profile.role} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Status
            </span>
            <StatusPill status={profile.status} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Member since
            </span>
            <span className="tnum text-sm font-medium text-ink">
              {new Date(profile.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </CardContent>
        </Card>
      </Reveal>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Phase 3 · Coming soon
          </div>
          <p className="font-display text-lg font-semibold tracking-tightest">
            {titleCase(profile.role)} workspace
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {ROLE_BLURB[profile.role]}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
