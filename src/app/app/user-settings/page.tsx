import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { requireActiveProfile } from "@/lib/auth";
import { getAsanaConnectionStatus } from "@/lib/asana/connection";
import { getGCalConnectionStatus } from "@/lib/google-calendar/connection";
import { isGmailConfigured } from "@/lib/gmail/config";
import { getGmailConnectionStatus } from "@/lib/gmail/connection";
import { listApiKeysForScope } from "@/lib/api-keys/actions";
import { createClient } from "@/lib/supabase/server";
import type { AsanaImportedProject } from "@/types/db";
import { ConnectedAccountsSection } from "../profile/ConnectedAccountsSection";
import { ApiKeysPanel } from "@/components/developer/ApiKeysPanel";
import { UserSettingsHashScroll } from "./UserSettingsHashScroll";

export const metadata: Metadata = { title: "Settings" };

type UserSettingsPageProps = {
  searchParams?: { asana?: string; gcal?: string; gmail?: string };
};

export default async function UserSettingsPage({
  searchParams,
}: UserSettingsPageProps) {
  const profile = await requireActiveProfile();
  if (!profile) redirect("/login");

  const [asanaConnection, gcalConnection, gmailConnection, importedProjects, apiKeys] =
    await Promise.all([
      getAsanaConnectionStatus(profile.id),
      getGCalConnectionStatus(profile.id),
      getGmailConnectionStatus(profile.id),
      loadImportedAsanaProjects(profile.id),
      listApiKeysForScope(null),
    ]);

  const asanaFlash =
    searchParams?.asana === "connected"
      ? "connected"
      : searchParams?.asana === "error"
        ? "error"
        : null;

  const gcalFlash =
    searchParams?.gcal === "connected"
      ? "connected"
      : searchParams?.gcal === "error"
        ? "error"
        : null;

  const gmailFlash =
    searchParams?.gmail === "connected"
      ? "connected"
      : searchParams?.gmail === "error"
        ? "error"
        : null;

  const gmailConfigured = isGmailConfigured();

  return (
    <div>
      <UserSettingsHashScroll />
      <PageHeader
        title="Settings"
        description="Manage your connected accounts, API keys, and personal integrations."
      />

      <Card id="section-connected" className="mt-4 scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <CardDescription>
            Link personal integrations — Asana for project tagging, Google
            Calendar for event sync, Gmail for inbox and time entry links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ConnectedAccountsSection
              asanaConnection={asanaConnection}
              importedProjects={importedProjects}
              gcalConnection={gcalConnection}
              gmailConnection={gmailConnection}
              gmailConfigured={gmailConfigured}
              asanaFlash={asanaFlash}
              gcalFlash={gcalFlash}
              gmailFlash={gmailFlash}
            />
          </Suspense>
        </CardContent>
      </Card>

      <div id="section-api-keys" className="mt-4 scroll-mt-20">
        <ApiKeysPanel
          keys={apiKeys}
          description="Personal API keys only access your personal workspace data."
        />
      </div>
    </div>
  );
}

async function loadImportedAsanaProjects(
  userId: string,
): Promise<AsanaImportedProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asana_imported_projects")
    .select("*")
    .eq("user_id", userId)
    .order("asana_project_name");

  if (error) {
    console.error("[user-settings] asana imported projects:", error.message);
    return [];
  }
  return (data ?? []) as AsanaImportedProject[];
}
