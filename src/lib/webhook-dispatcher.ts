import "server-only";

import crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db";
import type { WebhookEndpointRow, WebhookEvent } from "@/types/api";

const DELIVERY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_MAX = 500;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

function endpointMatchesEvent(endpoint: WebhookEndpointRow, eventType: string): boolean {
  if (!endpoint.events || endpoint.events.length === 0) return true;
  return endpoint.events.includes(eventType);
}

async function deliverToEndpoint(
  endpoint: WebhookEndpointRow,
  orgId: string,
  envelope: { id: string; event: string; created_at: string; data: Record<string, unknown> },
): Promise<void> {
  const db = createAdminClient();
  const body = JSON.stringify(envelope);
  const signature = crypto
    .createHmac("sha256", endpoint.secret)
    .update(body)
    .digest("hex");

  const now = new Date().toISOString();
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let status: "delivered" | "failed" = "failed";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cadence-Signature": `sha256=${signature}`,
        "User-Agent": "Cadence-Webhooks/1",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);
    responseStatus = res.status;
    const text = await res.text();
    responseBody = truncate(text, RESPONSE_BODY_MAX);
    status = res.ok ? "delivered" : "failed";
    if (!res.ok) {
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (e) {
    errorMessage =
      e instanceof Error ? e.message : "Webhook delivery failed";
  }

  await db.from("webhook_deliveries").insert({
    org_id: orgId,
    webhook_endpoint_id: endpoint.id,
    event_type: envelope.event,
    payload: envelope as unknown as Json,
    status,
    response_status: responseStatus,
    response_body: responseBody,
    error_message: errorMessage,
    attempts: 1,
    last_attempted_at: now,
    delivered_at: status === "delivered" ? now : null,
  });
}

/**
 * Dispatches a webhook event to all enabled endpoints for the org.
 * Fire-and-forget per endpoint — callers should `void dispatchWebhookEvent(...)`.
 */
export async function dispatchWebhookEvent(
  orgId: string,
  event: WebhookEvent,
): Promise<void> {
  const db = createAdminClient();
  const { data: endpoints, error } = await db
    .from("webhook_endpoints")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (error) {
    console.error("[webhooks] fetch endpoints failed:", error.message);
    return;
  }

  const matching = ((endpoints ?? []) as WebhookEndpointRow[]).filter((ep) =>
    endpointMatchesEvent(ep, event.type),
  );

  if (matching.length === 0) return;

  const envelope = {
    id: crypto.randomUUID(),
    event: event.type,
    created_at: new Date().toISOString(),
    data: event.data,
  };

  await Promise.all(
    matching.map((endpoint) => deliverToEndpoint(endpoint, orgId, envelope)),
  );
}
