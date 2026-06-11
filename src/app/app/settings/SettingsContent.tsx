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
import { ensureArray, normalizeAllowedDomains } from "@/lib/org-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/db";
import { SettingsTabs } from "./SettingsTabs";
import { LeaveTypesTab } from "./LeaveTypesTab";
import { SuperadminOrgSelect } from "./SuperadminOrgSelect";
import { GeneralSettingsTab } from "./GeneralSettingsTab";

export type SettingsFilters = {
  tab: string;
  org: string;
};

export async function SettingsContent({
  filters,
}: {
  filters: SettingsFilters;
}) {
  const admin = await requireRole(["admin", "superadmin"]);
  const isSuperadmin = admin.role === "superadmin";
  const tab = filters.tab;
  const selectedOrgId = isSuperadmin
    ? filters.org || admin.org_id || ""
    : admin.org_id ?? "";

  const adminDb = createAdminClient();
  const supabase = createClient();

  const orgs = ensureArray(
    isSuperadmin
      ? (
          await adminDb.from("organizations").select("id, name").order("name")
        ).data
      : [],
  );

  const { data: orgRaw } = selectedOrgId
    ? await (isSuperadmin ? adminDb : supabase)
        .from("organizations")
        .select("*")
        .eq("id", selectedOrgId)
        .single()
    : { data: null };

  const org = orgRaw
    ? ({
        ...orgRaw,
        allowed_domains: normalizeAllowedDomains(orgRaw.allowed_domains),
      } as Organization)
    : null;

  const leaveTypes =
    selectedOrgId && tab === "leave"
      ? ensureArray(await getOrgLeaveTypes(selectedOrgId))
      : [];

  return (
    <>
      <SettingsTabs tab={tab} isSuperadmin={isSuperadmin} />

      {isSuperadmin && (
        <div className="mb-6 max-w-md">
          <SuperadminOrgSelect orgs={orgs} selectedOrgId={selectedOrgId} />
        </div>
      )}

      <div className="w-full">
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
        ) : isSuperadmin && !selectedOrgId ? (
          <EmptyState
            title="Select an organization"
            description="Choose an organization above to edit general settings."
          />
        ) : org ? (
          <GeneralSettingsTab
            org={org}
            isAdmin={!isSuperadmin}
            orgIdField={isSuperadmin ? selectedOrgId : undefined}
          />
        ) : (
          <EmptyState
            title="No organization linked"
            description="Your admin account isn't attached to an organization yet."
          />
        )}
      </div>
    </>
  );
}
