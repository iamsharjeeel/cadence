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
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/db";
import { SettingsForm } from "./SettingsForm";
import { SettingsTabs } from "./SettingsTabs";
import { LeaveTypesTab } from "./LeaveTypesTab";
import { SuperadminOrgSelect } from "./SuperadminOrgSelect";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; org?: string };
}) {
  const admin = await requireRole(["admin", "superadmin"]);
  const isSuperadmin = admin.role === "superadmin";
  const tab = searchParams.tab ?? (isSuperadmin ? "leave" : "org");
  const selectedOrgId = isSuperadmin
    ? searchParams.org ?? ""
    : admin.org_id ?? "";

  const adminDb = createAdminClient();
  const supabase = createClient();

  const orgs = isSuperadmin
    ? (
        await adminDb.from("organizations").select("id, name").order("name")
      ).data ?? []
    : [];

  const { data: org } = selectedOrgId
    ? await (isSuperadmin ? adminDb : supabase)
        .from("organizations")
        .select("*")
        .eq("id", selectedOrgId)
        .single()
    : { data: null };

  const leaveTypes =
    selectedOrgId && tab === "leave"
      ? await getOrgLeaveTypes(selectedOrgId)
      : [];

  return (
    <div>
      <PageHeader
        title="Organization settings"
        description={
          isSuperadmin
            ? "Select an organization to manage leave types and balances."
            : "Manage your organization's identity, leave types, and domains."
        }
      />

      <SettingsTabs isSuperadmin={isSuperadmin} />

      {isSuperadmin && tab === "leave" && (
        <div className="mb-6 max-w-md">
          <SuperadminOrgSelect orgs={orgs} selectedOrgId={selectedOrgId} />
        </div>
      )}

      <div className="max-w-3xl">
        {tab === "leave" ? (
          <Card>
            <CardHeader>
              <CardTitle>Leave types</CardTitle>
              <CardDescription>
                Default types are seeded when an organization is created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSuperadmin && !selectedOrgId ? (
                <EmptyState
                  title="Select an organization"
                  description="Choose an organization above to manage leave types and apply default balances."
                />
              ) : selectedOrgId ? (
                <LeaveTypesTab types={leaveTypes} orgId={selectedOrgId} />
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
              {isSuperadmin ? (
                <EmptyState
                  title="Organization settings are admin-scoped"
                  description="Use the Leave types tab to configure leave for a specific organization. Org identity settings are managed by each organization's admin."
                />
              ) : org ? (
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
