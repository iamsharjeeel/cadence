import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { RolePill, StatusPill } from "@/components/ui/Badge";
import { requireActiveProfile } from "@/lib/auth";
import { formatMoney, titleCase } from "@/lib/utils";
import { ProfileNameForm } from "./ProfileNameForm";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await requireActiveProfile();

  return (
    <div>
      <PageHeader
        title="Your profile"
        description="Update your name. Role, rate, and status are set by your administrator."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>The only fields you can edit.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileNameForm
              defaultName={profile.full_name ?? ""}
              email={profile.email}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>Read-only — managed by an admin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field label="Role">
              <RolePill role={profile.role} />
            </Field>
            <Field label="Status">
              <StatusPill status={profile.status} />
            </Field>
            <Field label="Rate">
              <span className="tnum text-sm font-medium text-ink">
                {formatMoney(profile.rate, profile.currency)}
                {profile.rate !== null && (
                  <span className="ml-1 text-muted">
                    · {titleCase(profile.rate_type)}
                  </span>
                )}
              </span>
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}
