import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { requireRole } from "@/lib/auth";
import {
  fetchAuditLog,
  fetchAuditActors,
  fetchAuditActions,
} from "@/lib/audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLogViewer } from "./AuditLogViewer";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: {
    org?: string;
    actor?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}) {
  const profile = await requireRole(["admin", "superadmin"]);
  const isSuperadmin = profile.role === "superadmin";
  const page = Math.max(0, parseInt(searchParams.page ?? "0", 10) || 0);

  const orgId = isSuperadmin
    ? searchParams.org || null
    : profile.org_id;

  if (!isSuperadmin && !profile.org_id) {
    return (
      <div>
        <PageHeader title="Audit log" description="Organization activity history." />
        <p className="text-sm text-muted">Your account has no organization.</p>
      </div>
    );
  }

  const [{ entries, hasMore }, actors, actions, orgs] = await Promise.all([
    fetchAuditLog({
      orgId,
      actorId: searchParams.actor,
      action: searchParams.action,
      entity: searchParams.entity,
      from: searchParams.from,
      to: searchParams.to,
      page,
    }),
    fetchAuditActors(orgId),
    fetchAuditActions(orgId),
    isSuperadmin
      ? createAdminClient()
          .from("organizations")
          .select("id, name")
          .order("name")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Read-only history of actions across your organization."
      />
      <AuditLogViewer
        entries={entries}
        hasMore={hasMore}
        page={page}
        actors={actors}
        actions={actions}
        orgs={orgs}
        isSuperadmin={isSuperadmin}
        selectedOrgId={searchParams.org ?? ""}
      />
    </div>
  );
}
