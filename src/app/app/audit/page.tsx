import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { requireRole } from "@/lib/auth";
import {
  fetchAuditLog,
  fetchAuditActors,
  fetchAuditActions,
} from "@/lib/audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLogViewer, type AuditFilters } from "./AuditLogViewer";

export const metadata: Metadata = { title: "Audit log" };

function parseFilters(searchParams: {
  org?: string;
  actor?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: string;
}): { filters: AuditFilters; page: number } {
  return {
    filters: {
      org: searchParams.org?.trim() ?? "",
      actor: searchParams.actor?.trim() ?? "",
      action: searchParams.action?.trim() ?? "",
      entity: searchParams.entity?.trim() ?? "",
      from: searchParams.from?.trim() ?? "",
      to: searchParams.to?.trim() ?? "",
    },
    page: Math.max(0, parseInt(searchParams.page ?? "0", 10) || 0),
  };
}

async function AuditLogContent({
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
  const { filters, page } = parseFilters(searchParams);

  const orgId = isSuperadmin ? filters.org || null : profile.org_id;

  if (!isSuperadmin && !profile.org_id) {
    return (
      <p className="text-sm text-muted">Your account has no organization.</p>
    );
  }

  const [{ entries, hasMore }, actors, actions, orgs] = await Promise.all([
    fetchAuditLog({
      orgId,
      actorId: filters.actor || undefined,
      action: filters.action || undefined,
      entity: filters.entity || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
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
    <AuditLogViewer
      entries={entries}
      hasMore={hasMore}
      page={page}
      actors={actors}
      actions={actions}
      orgs={orgs}
      isSuperadmin={isSuperadmin}
      filters={filters}
    />
  );
}

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
  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Read-only history of actions across your organization."
      />
      <Suspense fallback={<CardSkeleton bars={6} />}>
        <AuditLogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
