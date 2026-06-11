import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/db";

/**
 * Refreshes the Supabase session cookie and enforces route guards.
 *
 * Returns the response that must be returned from `middleware.ts` so refreshed
 * auth cookies are persisted on every request.
 *
 * Guard logic:
 *   - `/app/**`  → requires an authenticated, ACTIVE user; otherwise redirect.
 *   - pending/suspended users are funnelled to `/pending`.
 *   - signed-in users who hit `/login` are bounced into the app.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApp = pathname.startsWith("/app");
  const isPending = pathname === "/pending";
  const isLogin = pathname === "/login";
  const isHome = pathname === "/";

  // Unauthenticated users may not enter the app shell.
  if (!user && (isApp || isPending)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Only fetch status when it actually gates the route, to keep middleware cheap.
    if (isApp || isPending || isLogin || isHome) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      const status = profile?.status ?? "pending";
      const blocked = status === "pending" || status === "suspended";

      if (isApp && blocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/pending";
        return NextResponse.redirect(url);
      }

      if ((isPending || isLogin || isHome) && !blocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
