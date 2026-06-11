import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireRole } from "@/lib/auth";
import { getOrgLeaveTypes } from "@/lib/leave/queries";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/db";
import { SettingsForm } from "./SettingsForm";
import { SettingsTabs } from "./SettingsTabs";
import { LeaveTypesTab } from "./LeaveTypesTab";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const admin = await requireRole(["admin"]);
  const tab = searchParams.tab ?? "org";

  const supabase = createClient();
  const { data: org } = admin.org_id
    ? await supabase
        .from("organizations")
        .select("*")
        .eq("id", admin.org_id)
        .single()
    : { data: null };

  const leaveTypes =
    admin.org_id && tab === "leave"
      ? await getOrgLeaveTypes(admin.org_id)
      : [];

  return (
    <div>
      <PageHeader
        title="Organization settings"
        description="Manage your organization's identity, leave types, and domains."
      />

      <SettingsTabs />

      <div className="max-w-3xl">
        {tab === "leave" ? (
          <Card>
            <CardHeader>
              <CardTitle>Leave types</CardTitle>
              <CardDescription>
                Default types are seeded when your organization is created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {admin.org_id ? (
                <LeaveTypesTab types={leaveTypes} />
              ) : (
                <EmptyState
                  title="No organization linked"
                  description="Your admin account isn't attached to an organization."
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>
                Changes are recorded in the audit log.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {org ? (
                <SettingsForm org={org as Organization} />
              ) : (
                <EmptyState
                  title="No organization linked"
                  description="Your admin account isn't attached to an organization yet. Contact a superadmin."
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
