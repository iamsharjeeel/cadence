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
import { createClient } from "@/lib/supabase/server";
import { formatMoney, titleCase } from "@/lib/utils";
import type { Profile } from "@/types/db";
import {
  ApproveButton,
  RateEditor,
  RoleSelect,
  StatusSelect,
} from "./controls";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const admin = await requireRole(["admin"]);

  const supabase = createClient();
  // RLS scopes this to the admin's own org; we also filter explicitly.
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("org_id", admin.org_id!)
    .order("created_at", { ascending: true });

  const members = (data ?? []) as Profile[];
  const pending = members.filter((m) => m.status === "pending");
  const team = members.filter((m) => m.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Approve new members and manage roles, rates, and access for your organization."
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
            New sign-ins matched to your organization, awaiting access.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No one's waiting"
                description="New members matched to your domain will appear here for approval."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
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
                description="Approve a pending member to build out your team."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Rate</TH>
                </TR>
              </THead>
              <TBody>
                {team.map((m) => {
                  const isSelf = m.id === admin.id;
                  const isSuper = m.role === "superadmin";
                  return (
                    <TR key={m.id}>
                      <TD>
                        <MemberCell member={m} />
                      </TD>
                      <TD>
                        {isSelf || isSuper ? (
                          <span className="text-sm text-muted">
                            {titleCase(m.role)}
                          </span>
                        ) : (
                          <RoleSelect
                            id={m.id}
                            current={m.role as "admin" | "employee"}
                          />
                        )}
                      </TD>
                      <TD>
                        {isSelf || isSuper ? (
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
                          {!isSuper && (
                            <RateEditor
                              id={m.id}
                              rate={m.rate}
                              rateType={m.rate_type}
                              currency={m.currency}
                            />
                          )}
                        </div>
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
