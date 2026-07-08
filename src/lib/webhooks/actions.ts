"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateWebhookUrl } from "@/lib/webhooks/url-guard";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookDeliverySummaryRow,
  type WebhookEndpointRow,
} from "@/types/api";

export type ActionResult = { ok: boolean; message: string };

export type CreateWebhookResult =
  | { ok: true; secret: string; endpointId: string }
  | ActionResult;

async function requireOrgManager(orgId: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx?.activeOrgId || ctx.activeOrgId !== orgId) {
    return { ok: false as const, message: "Switch to the organization workspace." };
  }
  if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
    return { ok: false as const, message: "Forbidden." };
  }
  return { ok: true as const, profile: ctx.realProfile };
}

export async function listWebhookEndpoints(
  orgId: string,
): Promise<WebhookEndpointRow[]> {
  const gate = await requireOrgManager(orgId);
  if (!gate.ok) return [];

  const db = createAdminClient();
  const { data, error } = await db
    .from("webhook_endpoints")
    .select("id, org_id, url, description, events, enabled, created_by, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[webhooks] list failed:", error.message);
    return [];
  }
  return (data ?? []) as WebhookEndpointRow[];
}

export async function listWebhookDeliveries(
  endpointId: string,
  limit = 20,
): Promise<WebhookDeliverySummaryRow[]> {
  await requireActiveProfile();
  const db = createAdminClient();

  const { data: endpoint } = await db
    .from("webhook_endpoints")
    .select("org_id")
    .eq("id", endpointId)
    .maybeSingle();

  if (!endpoint) return [];

  const gate = await requireOrgManager(endpoint.org_id);
  if (!gate.ok) return [];

  // Note: response_body and error_message are intentionally NOT selected here.
  // They are persisted server-side for operator debugging, but returning them
  // to the browser would turn outbound webhook delivery into a read-oracle for
  // SSRF (an attacker-controlled endpoint URL's response would be echoed back).
  const { data, error } = await db
    .from("webhook_deliveries")
    .select(
      "id, org_id, webhook_endpoint_id, event_type, status, response_status, attempts, created_at, delivered_at",
    )
    .eq("webhook_endpoint_id", endpointId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[webhooks] deliveries failed:", error.message);
    return [];
  }

  return (data ?? []) as WebhookDeliverySummaryRow[];
}

export async function createWebhookEndpoint(input: {
  orgId: string;
  url: string;
  description?: string;
  events: string[];
  secret: string;
}): Promise<CreateWebhookResult> {
  const gate = await requireOrgManager(input.orgId);
  if (!gate.ok) return gate;

  const url = input.url.trim();
  const urlCheck = await validateWebhookUrl(url);
  if (!urlCheck.ok) {
    return { ok: false, message: urlCheck.reason };
  }

  const secret = input.secret.trim();
  if (secret.length < 16) {
    return { ok: false, message: "Webhook secret must be at least 16 characters." };
  }

  const events = input.events.filter((e) =>
    (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e),
  );

  const db = createAdminClient();
  const { data, error } = await db
    .from("webhook_endpoints")
    .insert({
      org_id: input.orgId,
      url,
      description: input.description?.trim() || null,
      events,
      enabled: true,
      secret,
      created_by: gate.profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[webhooks] create failed:", error?.message);
    return { ok: false, message: "Couldn't create webhook endpoint." };
  }

  revalidatePath("/app/employees");
  return { ok: true, secret, endpointId: data.id };
}

export async function toggleWebhookEndpoint(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const db = createAdminClient();
  const { data: endpoint } = await db
    .from("webhook_endpoints")
    .select("org_id")
    .eq("id", id)
    .maybeSingle();

  if (!endpoint) return { ok: false, message: "Endpoint not found." };

  const gate = await requireOrgManager(endpoint.org_id);
  if (!gate.ok) return gate;

  const { error } = await db
    .from("webhook_endpoints")
    .update({ enabled })
    .eq("id", id);

  if (error) return { ok: false, message: "Couldn't update endpoint." };

  revalidatePath("/app/employees");
  return { ok: true, message: enabled ? "Endpoint enabled." : "Endpoint disabled." };
}

export async function deleteWebhookEndpoint(id: string): Promise<ActionResult> {
  const db = createAdminClient();
  const { data: endpoint } = await db
    .from("webhook_endpoints")
    .select("org_id")
    .eq("id", id)
    .maybeSingle();

  if (!endpoint) return { ok: false, message: "Endpoint not found." };

  const gate = await requireOrgManager(endpoint.org_id);
  if (!gate.ok) return gate;

  const { error } = await db.from("webhook_endpoints").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete endpoint." };

  revalidatePath("/app/employees");
  return { ok: true, message: "Endpoint deleted." };
}

export async function retryWebhookDeliveryAction(
  deliveryId: string,
): Promise<ActionResult> {
  const db = createAdminClient();
  const { data: delivery } = await db
    .from("webhook_deliveries")
    .select("org_id, webhook_endpoint_id")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!delivery?.webhook_endpoint_id) {
    return { ok: false, message: "Delivery not found." };
  }

  const gate = await requireOrgManager(delivery.org_id);
  if (!gate.ok) return gate;

  const { retryWebhookDelivery } = await import("@/lib/webhook-dispatcher");
  return retryWebhookDelivery(deliveryId);
}
