import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  getOrgReport,
  getPersonalReport,
  resolveReportRange,
} from "@/lib/reports/queries";
import { ReportsClient } from "./ReportsClient";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const preset =
    searchParams.preset === "this_month" ||
    searchParams.preset === "last_month" ||
    searchParams.preset === "custom"
      ? searchParams.preset
      : "this_week";

  const range = resolveReportRange(
    preset,
    searchParams.from,
    searchParams.to,
  );

  const personal = await getPersonalReport(ctx.effectiveProfile, range);

  const isManager =
    !ctx.isPersonal &&
    (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");
  const isEmployeeInOrg =
    !ctx.isPersonal && ctx.workspaceRole === "employee";

  // Employees in org context only see personal report (redirect if they hit org tab via URL — client hides tab).
  const showOrgTab = isManager;
  let org = null;
  if (isManager && ctx.activeOrgId) {
    org = await getOrgReport(ctx.activeOrgId, range);
  }

  if (isEmployeeInOrg && searchParams.preset === "org") {
    redirect("/app/reports");
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description={
          isEmployeeInOrg
            ? "Your logged hours and project breakdown."
            : "Personal and organization time reporting."
        }
      />
      <ReportsClient
        initialPersonal={personal}
        initialOrg={org}
        showOrgTab={showOrgTab}
        initialPreset={preset}
      />
    </div>
  );
}
