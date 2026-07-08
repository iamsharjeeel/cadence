import "server-only";

import crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateWebhookUrl } from "@/lib/webhooks/url-guard";
import type { Json } from "@/types/db";
import type { WebhookEndpointRow, WebhookEvent } from "@/types/api";

const DELIVERY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_MAX = 500;
const MAX_ATTEMPTS = 5;
const INLINE_ATTEMPTS = 3;
const INLINE_DELAYS_MS = [0, 1500, 4000];

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function endpointMatchesEvent(
  endpoint: WebhookEndpointRow,
  eventType: string,
): boolean {
  if (!endpoint.events || endpoint.events.length === 0) return true;
  return endpoint.events.includes(eventType);
}

function nextRetryAt(attempts: number): string {
  const delayMs = Math.min(3600_000, 60_000 * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delayMs).toISOString();
}

type DeliveryAttemptResult = {
  status: "delivered" | "failed";
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
};

async function postToEndpoint(
  endpoint: WebhookEndpointRow,
  body: string,
): Promise<DeliveryAttemptResult> {
  const signature = crypto
    .createHmac("sha256", endpoint.secret)
    .update(body)
    .digest("hex");

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let status: "delivered" | "failed" = "failed";

  // Re-validate the endpoint URL immediately before every delivery attempt
  // (not just at creation time). This closes the DNS-rebinding gap where a
  // hostname resolves to a public address when the endpoint is registered
  // but is later re-pointed at an internal/metadata address.
  const guard = await validateWebhookUrl(endpoint.url);
  if (!guard.ok) {
    return {
      status: "failed",
      responseStatus: null,
      responseBody: null,
      errorMessage: "Delivery blocked: endpoint URL failed security validation.",
    };
  }

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
      // Never auto-follow redirects: a 30x response could otherwise be used
      // to bypass the SSRF guard above and reach an internal host.
      redirect: "manual",
    });

    clearTimeout(timer);

    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      return {
        status: "failed",
        responseStatus: res.status || null,
        responseBody: null,
        errorMessage: "Delivery blocked: endpoint returned a redirect.",
      };
    }

    responseStatus = res.status;
    const text = await res.text();
    responseBody = truncate(text, RESPONSE_BODY_MAX);
    status = res.ok ? "delivered" : "failed";
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (e) {
    errorMessage =
      e instanceof Error ? e.message : "Webhook delivery failed";
  }

  return { status, responseStatus, responseBody, errorMessage };
}

async function deliverToEndpoint(
  endpoint: WebhookEndpointRow,
  orgId: string,
  envelope: {
    id: string;
    event: string;
    created_at: string;
    data: Record<string, unknown>;
  },
  existingDeliveryId?: string,
): Promise<void> {
  const db = createAdminClient();
  const body = JSON.stringify(envelope);
  const now = new Date().toISOString();

  let deliveryId = existingDeliveryId;
  let attempts = 0;

  if (!deliveryId) {
    const { data: row } = await db
      .from("webhook_deliveries")
      .insert({
        org_id: orgId,
        webhook_endpoint_id: endpoint.id,
        event_type: envelope.event,
        payload: envelope as unknown as Json,
        status: "pending",
        attempts: 0,
        last_attempted_at: now,
      })
      .select("id")
      .single();
    deliveryId = row?.id;
  }

  if (!deliveryId) return;

  const maxInline = existingDeliveryId ? 1 : INLINE_ATTEMPTS;

  for (let i = 0; i < maxInline; i++) {
    if (i > 0) await sleep(INLINE_DELAYS_MS[i] ?? 0);

    const result = await postToEndpoint(endpoint, body);
    attempts += 1;

    const delivered = result.status === "delivered";
    const { data: current } = await db
      .from("webhook_deliveries")
      .select("attempts")
      .eq("id", deliveryId)
      .maybeSingle();

    const totalAttempts = (current?.attempts ?? 0) + 1;

    await db
      .from("webhook_deliveries")
      .update({
        status: delivered ? "delivered" : "failed",
        response_status: result.responseStatus,
        response_body: result.responseBody,
        error_message: result.errorMessage,
        attempts: totalAttempts,
        last_attempted_at: new Date().toISOString(),
        delivered_at: delivered ? new Date().toISOString() : null,
        next_retry_at:
          delivered || totalAttempts >= MAX_ATTEMPTS
            ? null
            : nextRetryAt(totalAttempts),
      })
      .eq("id", deliveryId);

    if (delivered) return;
  }
}

export async function retryWebhookDelivery(
  deliveryId: string,
): Promise<{ ok: boolean; message: string }> {
  const db = createAdminClient();
  const { data: delivery } = await db
    .from("webhook_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!delivery || delivery.status === "delivered") {
    return { ok: false, message: "Delivery not found or already delivered." };
  }

  if ((delivery.attempts ?? 0) >= MAX_ATTEMPTS) {
    return { ok: false, message: "Maximum retry attempts reached." };
  }

  const { data: endpoint } = await db
    .from("webhook_endpoints")
    .select("*")
    .eq("id", delivery.webhook_endpoint_id ?? "")
    .maybeSingle();

  if (!endpoint) {
    return { ok: false, message: "Webhook endpoint not found." };
  }

  const payload = delivery.payload as {
    id: string;
    event: string;
    created_at: string;
    data: Record<string, unknown>;
  } | null;

  if (!payload?.event) {
    return { ok: false, message: "Invalid delivery payload." };
  }

  await deliverToEndpoint(
    endpoint as WebhookEndpointRow,
    delivery.org_id,
    payload,
    deliveryId,
  );

  const { data: updated } = await db
    .from("webhook_deliveries")
    .select("status")
    .eq("id", deliveryId)
    .maybeSingle();

  return updated?.status === "delivered"
    ? { ok: true, message: "Delivery succeeded." }
    : { ok: false, message: "Delivery failed — check endpoint logs." };
}

export async function processWebhookRetries(): Promise<number> {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data: due } = await db
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "failed")
    .lt("attempts", MAX_ATTEMPTS)
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", now)
    .limit(25);

  let processed = 0;
  for (const row of due ?? []) {
    await retryWebhookDelivery(row.id as string);
    processed += 1;
  }
  return processed;
}

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
