import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UploadWizard } from "./UploadWizard";

export const metadata: Metadata = { title: "New timesheet" };

export default async function NewTimesheetPage() {
  const profile = await requireActiveProfile();

  // The upload pipeline needs an org (storage path + RLS scope).
  if (!profile.org_id) {
    return (
      <div>
        <PageHeader title="New timesheet" />
        <Card>
          <CardContent>
            <EmptyState
              title="No organization linked"
              description="Your account isn't attached to an organization yet, so timesheets can't be submitted. Contact an administrator."
              action={
                <Link href="/app/timesheets">
                  <Button variant="ghost" size="sm">
                    Back to timesheets
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mapping is persisted per org slug; fall back to the org id.
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", profile.org_id)
    .single();
  const orgSlug = org?.slug ?? profile.org_id;

  return (
    <div>
      <PageHeader
        title="New timesheet"
        description="Upload a file or paste spreadsheet data from Excel or Google Sheets."
        action={
          <Link href="/app/timesheets">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        }
      />
      <UploadWizard orgSlug={orgSlug} />
    </div>
  );
}
