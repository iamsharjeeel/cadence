import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/db";

/**
 * Server Supabase client (anon key + the caller's cookie session).
 *
 * Use inside Server Components, Route Handlers, and Server Actions. Honours RLS
 * as the authenticated user. For privileged operations that must bypass RLS,
 * use the service-role client in `./admin` — and re-check the caller's role
 * before mutating.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // when middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}
