import { Suspense } from "react";

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

async function SettingsBody({
  filters,
}: {
  filters: SettingsFilters;
}) {
  const admin = await requireRole(["admin", "superadmin"]);
  const isSuperadmin = admin.role === "superadmin";
  const tab = filters.tab;

  let orgs: { id: string; name: string }[] = [];
  if (isSuperadmin) {
    const adminDb = createAdminClient();
    const { data, error } = await adminDb
      .from("organizations")
      .select("id, name")
      .order("name");
    if (error) {
      console.error("[SettingsContent] organizations list failed:", error);
      throw new Error("Couldn't load organizations.");
    }
    orgs = ensureArray(data);
  }

  // Superadmin scope comes from the org search param only — never profile.org_id.
  const selectedOrgId = isSuperadmin
    ? filters.org.trim()
    : admin.org_id ?? "";

  let org: Organization | null = null;
  if (selectedOrgId) {
    if (isSuperadmin) {
      const adminDb = createAdminClient();
      const { data: orgRaw, error } = await adminDb
        .from("organizations")
        .select("*")
        .eq("id", selectedOrgId)
        .maybeSingle();
      if (error) {
        console.error("[SettingsContent] org fetch failed:", {
          orgId: selectedOrgId,
          error,
        });
        throw new Error("Couldn't load organization settings.");
      }
      org = orgRaw
        ? ({
            ...orgRaw,
            allowed_domains: normalizeAllowedDomains(orgRaw.allowed_domains),
          } as Organization)
        : null;
    } else {
      const supabase = createClient();
      const { data: orgRaw, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", selectedOrgId)
        .maybeSingle();
      if (error) {
        console.error("[SettingsContent] org fetch failed:", {
          orgId: selectedOrgId,
          error,
        });
        throw new Error("Couldn't load organization settings.");
      }
      org = orgRaw
        ? ({
            ...orgRaw,
            allowed_domains: normalizeAllowedDomains(orgRaw.allowed_domains),
          } as Organization)
        : null;
    }
  }

  const leaveTypes =
    selectedOrgId && tab === "leave"
      ? ensureArray(await getOrgLeaveTypes(selectedOrgId))
      : [];

  return (
    <>
      <Suspense fallback={<div className="mb-6 h-10 max-w-md animate-pulse rounded bg-[var(--line)]" />}>
        <SettingsTabs tab={tab} isSuperadmin={isSuperadmin} />
      </Suspense>

      {isSuperadmin && (
        <div className="mb-6 max-w-md">
          <Suspense
            fallback={
              <div className="h-10 max-w-md animate-pulse rounded bg-[var(--line)]" />
            }
          >
            <SuperadminOrgSelect orgs={orgs} selectedOrgId={selectedOrgId} />
          </Suspense>
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
            title="Organization not found"
            description="That organization may have been removed. Pick another from the list above."
          />
        )}
      </div>
    </>
  );
}

export async function SettingsContent({
  filters,
}: {
  filters: SettingsFilters;
}) {
  try {
    return await SettingsBody({ filters });
  } catch (e) {
    console.error("[SettingsContent] render failed:", e);
    throw e;
  }
}
