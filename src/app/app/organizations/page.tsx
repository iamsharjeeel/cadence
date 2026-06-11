import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, titleCase } from "@/lib/utils";
import type { Organization } from "@/types/db";
import { CreateOrgForm } from "./CreateOrgForm";

export const metadata: Metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  await requireRole(["superadmin"]);

  // Superadmin sees all orgs (RLS permits; service-role not needed for reads).
  const supabase = createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  const orgs = (data ?? []) as Organization[];

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Create and oversee every tenant on the platform."
        action={<Badge tone="muted">{orgs.length} total</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>All organizations</CardTitle>
              <CardDescription>
                Tenants and the email domains that route to them.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {orgs.length === 0 ? (
                <div className="px-6 py-10">
                  <EmptyState
                    title="No organizations yet"
                    description="Create your first tenant to start onboarding members."
                  />
                </div>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Organization</TH>
                      <TH>Domains</TH>
                      <TH>Cadence</TH>
                      <TH>Created</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {orgs.map((org) => (
                      <TR key={org.id}>
                        <TD>
                          <p className="text-sm font-medium text-ink">
                            {org.name}
                          </p>
                          <p className="text-xs text-muted">
                            /{org.slug} · {org.base_currency}
                          </p>
                        </TD>
                        <TD>
                          {org.allowed_domains.length === 0 ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {org.allowed_domains.map((d) => (
                                <Badge key={d} tone="accent">
                                  {d}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TD>
                        <TD className="text-sm text-muted">
                          {titleCase(org.default_cadence)}
                        </TD>
                        <TD className="tnum text-sm text-muted">
                          {formatDate(org.created_at)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>New organization</CardTitle>
              <CardDescription>Add a tenant to the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateOrgForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
