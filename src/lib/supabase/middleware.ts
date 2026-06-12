import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/db";

/**
 * Refreshes the Supabase session cookie and enforces route guards.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApp = pathname.startsWith("/app");
  const isOnboarding = pathname.startsWith("/app/onboarding");
  const isPending = pathname === "/pending";
  const isLogin = pathname === "/login";
  const isHome = pathname === "/";

  if (isPending) {
    const url = request.nextUrl.clone();
    url.pathname = isLogin ? "/login" : user ? "/app/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  if (!user && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    if (isApp || isLogin || isHome) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status, role, onboarding_complete")
        .eq("id", user.id)
        .single();

      const suspended = profile?.status === "suspended";
      const needsOnboarding =
        profile?.status === "active" && !profile?.onboarding_complete;

      if (isApp && suspended) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "suspended");
        return NextResponse.redirect(url);
      }

      if (isApp && needsOnboarding && !isOnboarding) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/onboarding";
        return NextResponse.redirect(url);
      }

      if (isOnboarding && (profile?.onboarding_complete || suspended)) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/dashboard";
        return NextResponse.redirect(url);
      }

      if ((isLogin || isHome) && !suspended) {
        const url = request.nextUrl.clone();
        url.pathname = needsOnboarding
          ? "/app/onboarding"
          : "/app/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
