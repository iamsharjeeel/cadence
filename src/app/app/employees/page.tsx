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
import { Badge, StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, titleCase, roleLabel } from "@/lib/utils";
import type { Organization, Profile } from "@/types/db";
import { maskSensitive } from "@/lib/bank-crypto";
import { getOnboardingProgress, getOnboardingStepsDetail } from "@/lib/onboarding/progress";
import {
  ApproveButton,
  BankingEditor,
  RateEditor,
  RoleSelect,
  StatusSelect,
} from "./controls";
import { OnboardingCell } from "./OnboardingCell";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const actor = await requireRole(["admin", "owner", "superadmin"]);
  const isSuperadmin = actor.role === "superadmin";

  // Superadmin sees every org's members (service-role read, scoped in code).
  // Admin is scoped to their own org via the user-session client (RLS-backed).
  let members: Profile[] = [];
  const orgNames = new Map<string, string>();

  if (isSuperadmin) {
    const db = createAdminClient();
    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: true }),
      db.from("organizations").select("id, name"),
    ]);
    members = (profiles ?? []) as Profile[];
    for (const o of (orgs ?? []) as Pick<Organization, "id" | "name">[]) {
      orgNames.set(o.id, o.name);
    }
  } else {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("org_id", actor.org_id!)
      .order("created_at", { ascending: true });
    members = (data ?? []) as Profile[];
  }

  const pending = members.filter((m) => m.status === "pending");
  const team = members.filter((m) => m.status !== "pending");

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

  return (
    <div>
      <PageHeader
        title="Employees"
        description={
          isSuperadmin
            ? "Every member across all organizations. Approve, set roles, rates, and access."
            : "Approve new members and manage roles, rates, and access for your organization."
        }
        action={
          <Badge tone="muted">
            {members.length} {members.length === 1 ? "member" : "members"}
          </Badge>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Pending approval</CardTitle>
          <CardDescription>
            {isSuperadmin
              ? "New sign-ins across every organization, awaiting access."
              : "New sign-ins matched to your organization, awaiting access."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No one's waiting"
                description="New members matched to a domain will appear here for approval."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  {isSuperadmin && <TH>Organization</TH>}
                  <TH>Joined</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {pending.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <MemberCell member={m} />
                    </TD>
                    {isSuperadmin && (
                      <TD className="text-sm text-muted">
                        {orgLabel(m.org_id)}
                      </TD>
                    )}
                    <TD className="tnum text-muted">
                      {new Date(m.created_at).toLocaleDateString()}
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <ApproveButton id={m.id} />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Set role, status, and rate. Changes are recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {team.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No active members yet"
                description="Approve a pending member to build out the team."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  {isSuperadmin && <TH>Organization</TH>}
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Rate</TH>
                  <TH>Onboarding</TH>
                  <TH>Banking</TH>
                </TR>
              </THead>
              <TBody>
                {team.map((m) => {
                  const isSelf = m.id === actor.id;
                  const isSuper = m.role === "superadmin";
                  // Admin (Manager) cannot edit owner profiles.
                  const isOwnerTarget = m.role === "owner";
                  const locked = isSelf || isSuper || (actor.role === "admin" && isOwnerTarget);
                  const viewerRole = actor.role as "owner" | "admin" | "superadmin";
                  return (
                    <TR key={m.id}>
                      <TD>
                        <MemberCell member={m} />
                      </TD>
                      {isSuperadmin && (
                        <TD className="text-sm text-muted">
                          {orgLabel(m.org_id)}
                        </TD>
                      )}
                      <TD>
                        {locked ? (
                          <span className="text-sm text-muted">
                            {roleLabel(m.role)}
                          </span>
                        ) : (
                          <RoleSelect
                            id={m.id}
                            current={m.role as "owner" | "admin" | "employee"}
                            viewerRole={viewerRole}
                          />
                        )}
                      </TD>
                      <TD>
                        {locked ? (
                          <StatusPill status={m.status} />
                        ) : (
                          <StatusSelect id={m.id} current={m.status} />
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          <span className="tnum text-sm text-ink">
                            {formatMoney(m.rate, m.currency)}
                            <span className="ml-1 text-muted">
                              · {titleCase(m.rate_type)}
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
                      </TD>
                      <TD>
                        {onboardingByEmployee.get(m.id)?.label === "Complete" ? (
                          <span className="text-sm text-muted">Complete</span>
                        ) : (
                          <OnboardingCell
                            label={
                              onboardingByEmployee.get(m.id)?.label ?? "—"
                            }
                            steps={
                              onboardingByEmployee.get(m.id)?.steps ?? []
                            }
                          />
                        )}
                      </TD>
                      <TD>
                        {(!isSuper || isSelf) && (
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
                        )}
                      </TD>
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
      <Avatar name={member.full_name} email={member.email} size={34} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {member.full_name ?? "—"}
        </p>
        <p className="truncate text-xs text-muted">{member.email}</p>
      </div>
    </div>
  );
}
