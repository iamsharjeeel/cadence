import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { InboxView } from "@/components/gmail/InboxView";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { requireActiveProfile } from "@/lib/auth";
import { isGmailConfigured } from "@/lib/gmail/config";
import { getGmailConnectionStatus } from "@/lib/gmail/connection";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const profile = await requireActiveProfile();
  if (!profile) redirect("/login");

  if (!isGmailConfigured()) {
    return (
      <div>
        <PageHeader
          title="Inbox"
          description="Gmail sync is not enabled on this deployment."
        />
      </div>
    );
  }

  const connection = await getGmailConnectionStatus(profile.id);

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Synced Gmail threads — link client email to time entries from the time log."
      />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Email threads</CardTitle>
          <CardDescription>
            {connection.connected
              ? `Connected as ${connection.gmailEmail ?? "Gmail"}`
              : "Connect Gmail in Settings to sync your inbox."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InboxView connection={connection} />
        </CardContent>
      </Card>
    </div>
  );
}
