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
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RolePill, StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, roleLabel } from "@/lib/utils";
import type { Organization, Profile } from "@/types/db";
import { maskSensitive } from "@/lib/bank-crypto";

const TABLE_HEAD_CLASS =
  "bg-surface-low [&_th]:font-display [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em]";
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
import { AssignMemberModal } from "./AssignMemberModal";
import type { OrgInvite } from "@/lib/invites";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  // Track C: authorize against the ACTIVE workspace (true owner/admin role);
  // org members come from `memberships`, not the now-null profiles.org_id.
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const isSuperadmin = ctx.isSuperadmin;
  const wsRole = ctx.workspaceRole;
  if (!isSuperadmin && wsRole !== "owner" && wsRole !== "admin") {
    redirect("/app/dashboard");
  }
  const actor = ctx.effectiveProfile;
  const orgId = ctx.activeOrgId;
  const canInvite = !isSuperadmin && Boolean(orgId);

  let members: Profile[] = [];
  let pendingInvites: OrgInvite[] = [];
  const orgNames = new Map<string, string>();
  let orgOptions: Pick<Organization, "id" | "name">[] = [];
  let orgName = "";

  if (isSuperadmin) {
    const db = createAdminClient();
    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: true }),
      db.from("organizations").select("id, name"),
    ]);
    members = (profiles ?? []) as Profile[];
    orgOptions = (orgs ?? []) as Pick<Organization, "id" | "name">[];
    for (const o of orgOptions) {
      orgNames.set(o.id, o.name);
    }
  } else {
    const supabase = createClient();
    const db = createAdminClient();
    const [{ data: memRows }, { data: org }, { data: invites }] =
      await Promise.all([
        db
          .from("memberships")
          .select("user_id, role")
          .eq("org_id", orgId!),
        supabase.from("organizations").select("name").eq("id", orgId!).single(),
        db
          .from("org_invites")
          .select("*")
          .eq("org_id", orgId!)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
      ]);
    const roleByUser = new Map<string, string>(
      (memRows ?? []).map((m: any) => [m.user_id as string, m.role as string]),
    );
    const memberIds = [...roleByUser.keys()];
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
            role: (roleByUser.get(p.id) ?? p.role) as Profile["role"],
            org_id: orgId,
          }) as Profile,
      );
    }
    pendingInvites = (invites ?? []) as OrgInvite[];
    orgName = org?.name ?? "Organization";
  }

  const team = members.filter((m) => m.status !== "pending" || m.org_id);

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

  const orgLabel = (orgId: string | null) =>
    orgId ? orgNames.get(orgId) ?? "—" : "Unassigned";

  const canManageMembers = !isSuperadmin && (actor.role === "owner" || actor.role === "admin");

  return (
    <div>
      {!isSuperadmin && (
        <EmployeesListRefresh hasPendingInvites={pendingInvites.length > 0} />
      )}
      <PageHeader
        title="Employees"
        description={
          isSuperadmin
            ? "Every member across all organizations. Manage roles, rates, and access."
            : "Invite teammates and manage roles, rates, and access for your organization."
        }
        action={
          <div className="flex items-center gap-3">
            {canInvite && (
              <InviteMemberModal
                actorRole={wsRole === "owner" ? "owner" : "admin"}
                orgName={orgName}
              />
            )}
            <Badge tone="muted">
              {members.length} {members.length === 1 ? "member" : "members"}
            </Badge>
          </div>
        }
      />

      {!isSuperadmin && pendingInvites.length > 0 && (
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
                  {canManageMembers && <TH className="text-right">Actions</TH>}
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
                    {canManageMembers && (
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
                  canInvite
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
                  {isSuperadmin && <TH>Organization</TH>}
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Rate</TH>
                  <TH>Onboarding</TH>
                  <TH>Banking</TH>
                  {isSuperadmin && <TH className="text-right">Actions</TH>}
                  {canManageMembers && <TH className="text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {team.map((m) => {
                  const isSelf = m.id === actor.id;
                  const isSuper = m.role === "superadmin";
                  const isUnassigned = !m.org_id;
                  const locked = isSelf || isSuper;
                  const actorIsManager = actor.role === "admin";
                  const targetIsOwner = m.role === "owner";
                  const roleLocked = locked || (actorIsManager && targetIsOwner);
                  const canRemove =
                    canManageMembers &&
                    !locked &&
                    !isUnassigned &&
                    !(actorIsManager && (targetIsOwner || m.role === "admin"));
                  const manageMemberFields = !isUnassigned;

                  return (
                    <TR key={m.id} className="odd:bg-surface-low">
                      <TD>
                        <MemberCell member={m} />
                      </TD>
                      {isSuperadmin && (
                        <TD className="text-sm text-muted">
                          {orgLabel(m.org_id)}
                        </TD>
                      )}
                      <TD>
                        {!manageMemberFields ? (
                          <span className="text-sm text-muted">—</span>
                        ) : roleLocked ? (
                          <RolePill role={m.role} />
                        ) : (
                          <RoleSelect
                            id={m.id}
                            current={m.role as "owner" | "admin" | "employee"}
                            actorRole={actor.role}
                          />
                        )}
                      </TD>
                      <TD>
                        {!manageMemberFields ? (
                          <span className="text-sm text-muted">—</span>
                        ) : locked ? (
                          <StatusPill status={m.status} />
                        ) : (
                          <StatusSelect id={m.id} current={m.status} />
                        )}
                      </TD>
                      <TD>
                        {!manageMemberFields ? (
                          <span className="text-sm text-muted">Not in an org</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="tabular text-sm text-ink">
                              {formatMoney(m.rate, m.currency)}
                              <span className="ml-1 text-muted">
                                · {roleLabel(m.rate_type)}
                              </span>
                            </span>
                            {(!isSuper || isSelf) && (
                              <RateEditor
                                id={m.id}
                                rate={m.rate}
                                rateType={m.rate_type}
                                currency={m.currency}
                              />
                            )}
                          </div>
                        )}
                      </TD>
                      <TD>
                        {!manageMemberFields ? (
                          <span className="text-sm text-muted">—</span>
                        ) : onboardingByEmployee.get(m.id)?.label === "Complete" ? (
                          <span className="text-sm text-muted">Complete</span>
                        ) : m.role === "employee" ? (
                          <OnboardingCell
                            label={
                              onboardingByEmployee.get(m.id)?.label ?? "—"
                            }
                            steps={
                              onboardingByEmployee.get(m.id)?.steps ?? []
                            }
                          />
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </TD>
                      <TD>
                        {!manageMemberFields ? (
                          <span className="text-sm text-muted">—</span>
                        ) : (!isSuper || isSelf) ? (
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
                      {isSuperadmin && (
                        <TD className="text-right">
                          {isUnassigned && !isSuper ? (
                            <AssignMemberModal
                              memberId={m.id}
                              memberName={m.full_name?.trim() || m.email}
                              memberEmail={m.email}
                              orgs={orgOptions}
                            />
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </TD>
                      )}
                      {canManageMembers && (
                        <TD className="text-right">
                          {canRemove ? (
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
