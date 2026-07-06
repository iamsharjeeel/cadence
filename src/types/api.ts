/** API keys — table exists in Supabase; types maintained manually until regen. */
export type ApiKeyRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  permission: "read_only" | "full";
};

export type WebhookEndpointRow = {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string | null;
  events: string[];
  enabled: boolean;
  created_by: string;
  created_at: string;
};

export type WebhookDeliveryRow = {
  id: string;
  org_id: string;
  webhook_endpoint_id: string | null;
  timesheet_id: string | null;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  attempts: number;
  last_attempted_at: string | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export const WEBHOOK_EVENT_TYPES = [
  "timesheet.submitted",
  "timesheet.approved",
  "leave.requested",
  "leave.approved",
  "leave.rejected",
  "member.invited",
  "member.joined",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export type WebhookEvent = {
  type: WebhookEventType;
  data: Record<string, unknown>;
};
