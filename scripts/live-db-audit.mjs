import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function checkTable(name) {
  const { error } = await admin.from(name).select("*", { count: "exact", head: true });
  return error ? { ok: false, error: error.message } : { ok: true };
}

async function checkAnonBlocked(name, op) {
  if (op === "select") {
    const { data, error } = await anon.from(name).select("id").limit(1);
    if (error) return { blocked: true, detail: error.message };
    return { blocked: data?.length === 0, detail: `returned ${data?.length ?? 0} rows` };
  }
  if (op === "insert") {
    const { error } = await anon.from(name).insert({ name: "probe" });
    if (error) return { blocked: true, detail: error.message };
    return { blocked: false, detail: "insert succeeded (BAD)" };
  }
  return { blocked: false, detail: "unknown op" };
}

async function listAppliedMigrations() {
  const { data, error } = await admin
    .from("supabase_migrations.schema_migrations")
    .select("version")
    .order("version");
  if (error) return { ok: false, error: error.message };
  return { ok: true, versions: data?.map((r) => r.version) ?? [] };
}

async function main() {
  console.log("=== Cadence live DB audit (service role + anon) ===\n");
  console.log("Project URL:", url);

  for (const table of ["api_keys", "webhook_endpoints", "webhook_deliveries"]) {
    const t = await checkTable(table);
    console.log(`\n[table] ${table}:`, t.ok ? "exists" : `MISSING — ${t.error}`);
    if (t.ok) {
      const { count } = await admin.from(table).select("*", { count: "exact", head: true });
      console.log(`  admin row count:`, count ?? 0);
      const sel = await checkAnonBlocked(table, "select");
      console.log(`  anon SELECT:`, sel.blocked ? `blocked (${sel.detail})` : `LEAK (${sel.detail})`);
    }
  }

  const fakeUser = "00000000-0000-0000-0000-000000000001";
  const ins = await anon.from("api_keys").insert({
    user_id: fakeUser,
    name: "probe",
    key_hash: "probe-hash-" + Date.now(),
    key_prefix: "cad_live_probe",
  });
  console.log(
    "\n[RLS] anon INSERT api_keys:",
    ins.error ? `blocked (${ins.error.message})` : "SUCCESS — RLS GAP",
  );

  const insWh = await anon.from("webhook_endpoints").insert({
    org_id: fakeUser,
    url: "https://example.com/hook",
    secret: "probe-secret-16chars",
    created_by: fakeUser,
  });
  console.log(
    "[RLS] anon INSERT webhook_endpoints:",
    insWh.error ? `blocked (${insWh.error.message})` : "SUCCESS — RLS GAP",
  );

  const mig = await listAppliedMigrations();
  if (mig.ok) {
    console.log("\n[migrations] applied count:", mig.versions.length);
    const f4 = mig.versions.filter((v) => v.includes("api") || v.includes("f4") || v.includes("webhook"));
    console.log("  F4-related:", f4.length ? f4.join(", ") : "(none named api/f4/webhook)");
    console.log("  latest 5:", mig.versions.slice(-5).join(", "));
  } else {
    console.log("\n[migrations] could not read schema_migrations:", mig.error);
  }

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
