import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/db";

/**
 * Browser Supabase client (anon key only).
 *
 * Safe to import in Client Components. Uses the public anon key and the user's
 * cookie-based session. NEVER put service-role logic here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
