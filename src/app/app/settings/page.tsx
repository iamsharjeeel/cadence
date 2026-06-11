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
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/db";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireRole(["admin"]);

  const supabase = createClient();
  const { data: org } = admin.org_id
    ? await supabase
        .from("organizations")
        .select("*")
        .eq("id", admin.org_id)
        .single()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Organization settings"
        description="Manage your organization's identity, currency, cadence, and domains."
      />

      <div className="max-w-2xl">
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
      </div>
    </div>
  );
}
