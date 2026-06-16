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
import { Badge, RolePill, StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, roleLabel } from "@/lib/utils";
import type { Profile } from "@/types/db";
import { maskSensitive } from "@/lib/bank-crypto";
import { getOnboardingProgress, getOnboardingStepsDetail } from "@/lib/onboarding/progress";
import {
  BankingEditor,
  RateEditor,
  RoleSelect,
  StatusSelect,
} from "./controls";
import { OnboardingCell } from "./OnboardingCell";
import { InviteMemberModal } from "./InviteMemberModal";
import { CancelInviteButton } from "./CancelInviteButton";
import { EmployeesListRefresh } from "./EmployeesListRefresh";
import { RemoveMemberModal } from "./RemoveMemberModal";
import type { OrgInvite } from "@/lib/invites";
import type { WorkspaceRole } from "@/lib/workspace";

const TABLE_HEAD_CLASS =
  "bg-surface-low [&_th]:font-display [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em]";

export async function OrgTeamView({
  orgId,
  workspaceRole,
  actorId,
}: {
  orgId: string;
  workspaceRole: WorkspaceRole;
  actorId: string;
}) {
  const supabase = createClient();
  const db = createAdminClient();

  const [{ data: memRows }, { data: org }, { data: invites }] = await Promise.all([
    db.from("memberships").select("user_id, role").eq("org_id", orgId),
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    db
      .from("org_invites")
      .select("*")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const roleByUser = new Map<string, WorkspaceRole>(
    (memRows ?? []).map((m) => [m.user_id as string, m.role as WorkspaceRole]),
  );
  const memberIds = [...roleByUser.keys()];

  let members: Profile[] = [];
  if (memberIds.length > 0) {
    const { data: profs } = await db
      .from("profiles")
      .select("*")
      .in("id", memberIds)
      .order("created_at", { ascending: true });
    members = ((profs ?? []) as Profile[]).map(
      (p) =>
        ({
          ...p,
          role: roleByUser.get(p.id) ?? p.role,
          org_id: orgId,
        }) as Profile,
    );
  }

  const pendingInvites = (invites ?? []) as OrgInvite[];
  const orgName = org?.name ?? "Organization";
  const team = members.filter((m) => m.status !== "pending" || m.org_id);
  const canInvite = workspaceRole === "owner";
  const canChangeRoles = workspaceRole === "owner";
  const canRemove = workspaceRole === "owner";
  const canManageMembers = workspaceRole === "owner" || workspaceRole === "admin";

  const onboardingByEmployee = new Map<
    string,
    { label: string; steps: { step: string; completed_at: string | null }[] }
  >();
  for (const m of team.filter((x) => x.role === "employee")) {
    const [progress, steps] = await Promise.all([
      getOnboardingProgress(m.id),
      getOnboardingStepsDetail(m.id),
    ]);
    onboardingByEmployee.set(m.id, { label: progress.label, steps });
  }

  return (
    <div>
      <EmployeesListRefresh hasPendingInvites={pendingInvites.length > 0} />
      <PageHeader
        title="Organization"
        description="Manage members, roles, and organization settings."
        action={
          <div className="flex items-center gap-3">
            {canInvite && (
              <InviteMemberModal
                actorRole={workspaceRole === "owner" ? "owner" : "admin"}
                orgName={orgName}
              />
            )}
            <Badge tone="muted">
              {members.length} {members.length === 1 ? "member" : "members"}
            </Badge>
          </div>
        }
      />

      {pendingInvites.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>
              Invited members appear here until they sign in with Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden p-0">
            <Table className="border-0">
              <THead className={TABLE_HEAD_CLASS}>
                <TR>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Sent</TH>
                  {canInvite && <TH className="text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {pendingInvites.map((inv) => (
                  <TR key={inv.id} className="odd:bg-surface-low">
                    <TD className="text-sm text-ink">{inv.email}</TD>
                    <TD>
                      <RolePill role={inv.role} />
                    </TD>
                    <TD className="tabular text-sm text-muted">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TD>
                    {canInvite && (
                      <TD className="text-right">
                        <CancelInviteButton inviteId={inv.id} email={inv.email} />
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Set role, status, and rate. Changes are recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {team.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No team members yet"
                description={
                  canManageMembers
                    ? "Invite someone by email to get started."
                    : "Members will appear here once they join."
                }
              />
            </div>
          ) : (
            <Table className="border-0">
              <THead className={TABLE_HEAD_CLASS}>
                <TR>
                  <TH>Member</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Rate</TH>
                  <TH>Onboarding</TH>
                  <TH>Banking</TH>
                  {canInvite && <TH className="text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {team.map((m) => {
                  const isSelf = m.id === actorId;
                  const isSuper = m.role === "superadmin";
                  const locked = isSelf || isSuper;
                  const actorIsManager = workspaceRole === "admin";
                  const targetIsOwner = m.role === "owner";
                  const roleLocked =
                    locked ||
                    !canChangeRoles ||
                    (actorIsManager && targetIsOwner);
                  const canRemoveMember =
                    canRemove &&
                    !locked &&
                    !(actorIsManager && (targetIsOwner || m.role === "admin"));

                  return (
                    <TR key={m.id} className="odd:bg-surface-low">
                      <TD>
                        <MemberCell member={m} />
                      </TD>
                      <TD>
                        {roleLocked || !canChangeRoles ? (
                          <RolePill role={m.role} />
                        ) : (
                          <RoleSelect
                            id={m.id}
                            current={m.role as "owner" | "admin" | "employee"}
                            actorRole="owner"
                          />
                        )}
                      </TD>
                      <TD>
                        {locked || !canChangeRoles ? (
                          <StatusPill status={m.status} />
                        ) : (
                          <StatusSelect id={m.id} current={m.status} />
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          <span className="tabular text-sm text-ink">
                            {formatMoney(m.rate, m.currency)}
                            <span className="ml-1 text-muted">
                              · {roleLabel(m.rate_type)}
                            </span>
                          </span>
                          {canChangeRoles && (!isSuper || isSelf) && (
                            <RateEditor
                              id={m.id}
                              rate={m.rate}
                              rateType={m.rate_type}
                              currency={m.currency}
                            />
                          )}
                        </div>
                      </TD>
                      <TD>
                        {onboardingByEmployee.get(m.id)?.label === "Complete" ? (
                          <span className="text-sm text-muted">Complete</span>
                        ) : m.role === "employee" ? (
                          <OnboardingCell
                            label={onboardingByEmployee.get(m.id)?.label ?? "—"}
                            steps={onboardingByEmployee.get(m.id)?.steps ?? []}
                          />
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </TD>
                      <TD>
                        {canChangeRoles && (!isSuper || isSelf) ? (
                          <BankingEditor
                            id={m.id}
                            defaults={{
                              bank_name: m.bank_name ?? "",
                              bank_account_name: m.bank_account_name ?? "",
                              tax_id: m.tax_id ?? "",
                              address: m.address ?? "",
                              payment_terms_days: m.payment_terms_days ?? 14,
                            }}
                            accountMasked={maskSensitive(m.bank_account_number)}
                            bsbMasked={maskSensitive(m.bank_bsb_swift)}
                          />
                        ) : null}
                      </TD>
                      {canInvite && (
                        <TD className="text-right">
                          {canRemoveMember ? (
                            <RemoveMemberModal
                              memberId={m.id}
                              memberName={m.full_name?.trim() || m.email}
                              memberEmail={m.email}
                            />
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MemberCell({ member }: { member: Profile }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={member.full_name} email={member.email} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {member.full_name ?? "—"}
        </p>
        <p className="truncate text-xs text-muted">{member.email}</p>
      </div>
    </div>
  );
}
