import crypto from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// This script writes live api_keys/webhook_endpoints/time_entries rows with the
// service-role key, so it must never silently default to production. Require an
// explicit target URL (and pass --yes-i-mean-prod when that URL is prod).
const APP_URL = process.env.CADENCE_APP_URL;
if (!APP_URL) {
  console.error(
    "Set CADENCE_APP_URL to the target (e.g. http://localhost:3000). " +
      "This script performs service-role writes — it will not default to prod.",
  );
  process.exit(1);
}
const IS_PROD = /vercel\.app|cadence-eta-five/.test(APP_URL);
if (IS_PROD && !process.argv.includes("--yes-i-mean-prod")) {
  console.error(
    `Refusing to run against ${APP_URL} without --yes-i-mean-prod.`,
  );
  process.exit(1);
}
const API_PREFIX = `${APP_URL}/api/v1`;

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function keyPrefix(key) {
  return key.slice(0, 12);
}

async function apiFetch(path, key, opts = {}) {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Cadence-API-Version": "1",
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

async function createWebhookSiteInbox() {
  const res = await fetch("https://webhook.site/token", { method: "POST" });
  const data = await res.json();
  const uuid = data.uuid;
  if (!uuid) throw new Error("webhook.site token creation failed");
  return { uuid, url: `https://webhook.site/${uuid}` };
}

async function waitForWebhookDelivery(uuid, secret, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `https://webhook.site/token/${uuid}/requests?sorting=newest&per_page=1`,
    );
    const data = await res.json();
    const req = data?.data?.[0];
    if (req) {
      const body = req.content ?? req.raw ?? "";
      const sigHeader =
        req.headers?.["x-cadence-signature"]?.[0] ??
        req.headers?.["X-Cadence-Signature"]?.[0];
      const expected = sigHeader
        ? crypto.createHmac("sha256", secret).update(body).digest("hex")
        : null;
      const sigOk =
        sigHeader && expected && sigHeader === `sha256=${expected}`;
      return { req, body, sigHeader, sigOk };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function deliverWebhook(db, endpoint, orgId, event) {
  const envelope = {
    id: crypto.randomUUID(),
    event: event.type,
    created_at: new Date().toISOString(),
    data: event.data,
  };
  const body = JSON.stringify(envelope);
  const signature = crypto
    .createHmac("sha256", endpoint.secret)
    .update(body)
    .digest("hex");

  const now = new Date().toISOString();
  let responseStatus = null;
  let responseBody = null;
  let errorMessage = null;
  let status = "failed";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
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
    responseBody = (await res.text()).slice(0, 500);
    status = res.ok ? "delivered" : "failed";
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "delivery failed";
  }

  const { data: delivery, error } = await db
    .from("webhook_deliveries")
    .insert({
      org_id: orgId,
      webhook_endpoint_id: endpoint.id,
      event_type: envelope.event,
      payload: envelope,
      status,
      response_status: responseStatus,
      response_body: responseBody,
      error_message: errorMessage,
      attempts: 1,
      last_attempted_at: now,
      delivered_at: status === "delivered" ? now : null,
    })
    .select("id, status")
    .single();

  if (error) throw new Error(`delivery log insert: ${error.message}`);
  return { delivery, envelope, signature, responseStatus, status };
}

async function insertApiKey(db, userId, orgId, label) {
  const fullKey = "cad_live_" + crypto.randomBytes(32).toString("hex");
  const { data, error } = await db
    .from("api_keys")
    .insert({
      user_id: userId,
      org_id: orgId,
      name: label,
      key_hash: hashApiKey(fullKey),
      key_prefix: keyPrefix(fullKey),
    })
    .select("id")
    .single();
  if (error) throw new Error(`api key insert: ${error.message}`);
  return { id: data.id, fullKey };
}

const env = loadEnv();
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const PERSONAL_USER = "521dce7d-4074-4588-a279-8b8d7c297b8d";
const ORG_ID = "16ad4e7f-2ec7-4b19-b8fc-c86228ee5428";
const ORG_OWNER = "6c2a8dea-46e2-4cdf-b841-71ac0d067834";

const cleanup = { apiKeyIds: [], entryIds: [], webhookEndpointIds: [] };

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}: ${detail}`);
}

try {
  console.log(`\n=== Cadence prod QA @ ${APP_URL} ===\n`);

  const unauth = await apiFetch("/time-entries", "invalid-key");
  if (unauth.status === 401) {
    pass("api_unauthorized", "invalid key → 401");
  } else {
    fail("api_unauthorized", `expected 401 got ${unauth.status}`);
  }

  const personalKey = await insertApiKey(
    db,
    PERSONAL_USER,
    null,
    "qa-probe-personal",
  );
  cleanup.apiKeyIds.push(personalKey.id);

  const getEntries = await apiFetch("/time-entries?limit=5", personalKey.fullKey);
  if (getEntries.status === 200 && Array.isArray(getEntries.json.data)) {
    pass("api_get_time_entries", `200, ${getEntries.json.total ?? getEntries.json.data.length} total`);
  } else {
    fail("api_get_time_entries", `${getEntries.status} ${JSON.stringify(getEntries.json)}`);
  }

  const getProjects = await apiFetch("/projects", personalKey.fullKey);
  if (getProjects.status === 200 && Array.isArray(getProjects.json.data)) {
    pass("api_get_projects", `200, ${getProjects.json.data.length} projects`);
  } else {
    fail("api_get_projects", `${getProjects.status} ${JSON.stringify(getProjects.json)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const postEntry = await apiFetch("/time-entries", personalKey.fullKey, {
    method: "POST",
    body: JSON.stringify({
      date: today,
      hours: 0.25,
      description: "api-v1-qa-probe",
      billable: false,
    }),
  });
  if (postEntry.status === 201 && postEntry.json.data?.id) {
    cleanup.entryIds.push(postEntry.json.data.id);
    pass("api_post_time_entry", `201 id=${postEntry.json.data.id.slice(0, 8)}…`);
  } else {
    fail("api_post_time_entry", `${postEntry.status} ${JSON.stringify(postEntry.json)}`);
  }

  const orgKey = await insertApiKey(
    db,
    ORG_OWNER,
    ORG_ID,
    "qa-probe-org",
  );
  cleanup.apiKeyIds.push(orgKey.id);

  const getMembers = await apiFetch("/members", orgKey.fullKey);
  if (getMembers.status === 200 && Array.isArray(getMembers.json.data)) {
    pass("api_get_members", `200, ${getMembers.json.data.length} members`);
  } else {
    fail("api_get_members", `${getMembers.status} ${JSON.stringify(getMembers.json)}`);
  }

  const personalMembers = await apiFetch("/members", personalKey.fullKey);
  if (personalMembers.status === 403) {
    pass("api_members_personal_forbidden", "403 as expected");
  } else {
    fail("api_members_personal_forbidden", `expected 403 got ${personalMembers.status}`);
  }

  const inbox = await createWebhookSiteInbox();
  const webhookSecret = "qa-webhook-secret-" + crypto.randomBytes(8).toString("hex");
  const { data: endpoint, error: whErr } = await db
    .from("webhook_endpoints")
    .insert({
      org_id: ORG_ID,
      url: inbox.url,
      secret: webhookSecret,
      description: "qa-probe",
      events: ["member.joined"],
      enabled: true,
      created_by: ORG_OWNER,
    })
    .select("*")
    .single();
  if (whErr || !endpoint) throw new Error(`webhook endpoint: ${whErr?.message}`);
  cleanup.webhookEndpointIds.push(endpoint.id);

  const delivery = await deliverWebhook(db, endpoint, ORG_ID, {
    type: "member.joined",
    data: { probe: true, org_id: ORG_ID },
  });

  if (delivery.status === "delivered" && delivery.responseStatus === 200) {
    pass("webhook_delivery", `delivered HTTP ${delivery.responseStatus}, log=${delivery.delivery.id.slice(0, 8)}…`);
  } else {
    fail("webhook_delivery", `status=${delivery.status} http=${delivery.responseStatus}`);
  }

  const received = await waitForWebhookDelivery(inbox.uuid, webhookSecret);
  if (received?.sigOk) {
    pass("webhook_signature", "X-Cadence-Signature HMAC verified");
  } else if (received) {
    fail("webhook_signature", `sig mismatch header=${received.sigHeader}`);
  } else {
    fail("webhook_signature", "no request received at webhook.site within timeout");
  }

  if (received?.body) {
    try {
      const parsed = JSON.parse(received.body);
      if (parsed.event === "member.joined" && parsed.data?.probe === true) {
        pass("webhook_payload", "event envelope intact");
      } else {
        fail("webhook_payload", JSON.stringify(parsed).slice(0, 120));
      }
    } catch {
      fail("webhook_payload", "invalid JSON body");
    }
  }
} catch (e) {
  fail("fatal", e instanceof Error ? e.message : String(e));
} finally {
  for (const id of cleanup.entryIds) {
    await db.from("time_entries").delete().eq("id", id);
  }
  for (const id of cleanup.apiKeyIds) {
    await db
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
  }
  for (const id of cleanup.webhookEndpointIds) {
    await db.from("webhook_endpoints").delete().eq("id", id);
  }
  console.log("\nCleanup done (test keys revoked, probe entry removed).\n");
}

const failed = results.filter((r) => !r.ok);
console.log("=== Summary ===");
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
