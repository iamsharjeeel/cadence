export type ApproverScope = "owner_only" | "owner_and_managers";

export type OrgTier = "business" | string;

export type OrgSettings = {
  id: string;
  org_id: string;
  tier: OrgTier;
  approvals_timesheets: boolean;
  approvals_leave: boolean;
  approvals_expenses: boolean;
  approver_scope: ApproverScope;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_ORG_SETTINGS: Omit<
  OrgSettings,
  "id" | "org_id" | "created_at" | "updated_at"
> = {
  tier: "business",
  approvals_timesheets: false,
  approvals_leave: false,
  approvals_expenses: false,
  approver_scope: "owner_only",
};
