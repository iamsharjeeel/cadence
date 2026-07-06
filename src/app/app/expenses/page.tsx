import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { canApproveInOrg } from "@/lib/approvals";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";
import { formatDate } from "@/lib/utils";
import {
  getExpensesForWorkspace,
  getPendingExpenses,
} from "./actions";
import { ExpenseAdminView } from "./ExpenseAdminView";
import { ExpenseSubmitForm } from "./ExpenseSubmitForm";

export const metadata: Metadata = { title: "Expenses" };

function statusLabel(status: string): string {
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return status;
}

export default async function ExpensesPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  if (!ctx.activeOrgId) {
    return (
      <div>
        <PageHeader
          title="Expenses"
          description="Submit and track organization expenses."
        />
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="Organization workspace required"
              description="Switch to an organization workspace to submit expenses."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const orgId: string = ctx.activeOrgId;
  const userId = ctx.realProfile.id;
  const isApprover = await canApproveInOrg(orgId, ctx.workspaceRole);

  const db = createAdminClient();
  const [{ data: org }, myExpenses, pendingExpenses] = await Promise.all([
    db.from("organizations").select("base_currency").eq("id", orgId).maybeSingle(),
    getExpensesForWorkspace(orgId, userId),
    isApprover ? getPendingExpenses(orgId) : Promise.resolve([]),
  ]);

  const currency = org?.base_currency ?? "USD";

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Submit expenses for reimbursement or tracking."
      />

      {isApprover ? <ExpenseAdminView pending={pendingExpenses} /> : null}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">New expense</CardTitle>
          <CardDescription>
            Submissions follow your organization approval settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseSubmitForm defaultCurrency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your expenses</CardTitle>
          <CardDescription>
            {myExpenses.length}{" "}
            {myExpenses.length === 1 ? "submission" : "submissions"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {myExpenses.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No expenses yet"
                description="Submit your first expense using the form above."
              />
            </div>
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Description</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {myExpenses.map((expense) => (
                  <TR key={expense.id}>
                    <TD>{formatDate(expense.expense_date)}</TD>
                    <TD className="max-w-[320px] truncate">
                      {expense.description}
                    </TD>
                    <TD className="tabular">
                      {expense.currency} {Number(expense.amount).toFixed(2)}
                    </TD>
                    <TD>{statusLabel(expense.status)}</TD>
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
