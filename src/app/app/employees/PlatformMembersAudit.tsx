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
import { Badge, RolePill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/db";

const TABLE_HEAD_CLASS =
  "bg-surface-low [&_th]:font-display [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em]";

type AuditMember = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  membershipRole: UserRole | null;
};

function displayRole(member: AuditMember): UserRole {
  if (member.role === "superadmin") return "superadmin";
  return member.membershipRole ?? member.role;
}

export async function PlatformMembersAudit() {
  const db = createAdminClient();
  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email, role")
      .order("created_at", { ascending: true }),
    db.from("memberships").select("user_id, role, created_at"),
  ]);

  const roleByUser = new Map<string, UserRole>();
  for (const m of memberships ?? []) {
    const uid = m.user_id as string;
    const role = m.role as UserRole;
    const existing = roleByUser.get(uid);
    if (!existing || role === "owner" || (role === "admin" && existing === "employee")) {
      roleByUser.set(uid, role);
    }
  }

  const members: AuditMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role as UserRole,
    membershipRole: roleByUser.get(p.id) ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Organization"
        description="Platform audit view — read only."
      />

      <p className="mb-4 text-sm font-medium text-muted">
        Platform audit view — read only
      </p>

      <Card>
        <CardHeader>
          <CardTitle>All members</CardTitle>
          <CardDescription>
            Cross-platform member directory for oversight. No management actions.
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
                  <TH>Member</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                </TR>
              </THead>
              <TBody>
                {members.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.full_name} email={m.email} size={36} />
                        <p className="truncate text-sm font-medium text-ink">
                          {m.full_name?.trim() || "—"}
                        </p>
                      </div>
                    </TD>
                    <TD className="text-sm text-ink">{m.email}</TD>
                    <TD>
                      <RolePill role={displayRole(m)} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <Badge tone="muted">{members.length} members</Badge>
      </div>
    </div>
  );
}
