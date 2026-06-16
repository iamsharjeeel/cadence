import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLE_HEAD_CLASS =
  "bg-surface-low [&_th]:font-display [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em]";

type AuditMember = {
  id: string;
  full_name: string | null;
  email: string;
  emergency_phone: string | null;
};

export async function PlatformMembersAudit() {
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, emergency_phone")
    .order("created_at", { ascending: true });

  const members = (data ?? []) as AuditMember[];

  return (
    <div>
      <PageHeader
        title="Platform members"
        description="Platform oversight — account directory for audit. Org membership and sensitive HR data are managed inside each workspace."
        action={
          <Badge tone="muted">
            {members.length} {members.length === 1 ? "account" : "accounts"}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All accounts</CardTitle>
          <CardDescription>
            Member ID, contact details, and audit trail links only.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {members.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No accounts yet"
                description="Signed-in users will appear here."
              />
            </div>
          ) : (
            <Table className="border-0">
              <THead className={TABLE_HEAD_CLASS}>
                <TR>
                  <TH>Member ID</TH>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                  <TH className="text-right">Audit</TH>
                </TR>
              </THead>
              <TBody>
                {members.map((m) => (
                  <TR key={m.id} className="odd:bg-surface-low">
                    <TD className="font-mono text-xs text-muted">{m.id}</TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.full_name} email={m.email} size={36} />
                        <p className="truncate text-sm font-medium text-ink">
                          {m.full_name?.trim() || "—"}
                        </p>
                      </div>
                    </TD>
                    <TD className="text-sm text-ink">{m.email}</TD>
                    <TD className="text-sm text-muted">
                      {m.emergency_phone?.trim() || "—"}
                    </TD>
                    <TD className="text-right">
                      <Link href={`/app/audit?actor=${m.id}`}>
                        <Button variant="ghost" size="sm">
                          View audit
                        </Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
