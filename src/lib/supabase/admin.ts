import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/db";

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * The `server-only` import above is a hard guard: if this module is ever pulled
 * into a Client Component bundle, the build fails. NEVER import this from client
 * code. Only use inside Server Actions / Route Handlers, and ALWAYS re-check the
 * caller's role server-side before performing privileged writes.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — refusing to create admin client.",
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
