import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runOnboarding } from "@/lib/onboarding";

/**
 * OAuth callback. Exchanges the `code` for a session, runs domain-gating /
 * superadmin backstop, then redirects by status:
 *   - active  → /app/dashboard
 *   - pending / suspended → /pending
 * Errors fall back to /login with a flag.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError || !code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=exchange`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(`${origin}/login?error=session`);
  }

  const profile = await runOnboarding(user.id, user.email);

  const destination =
    profile?.status === "active" ? "/app/dashboard" : "/pending";

  return NextResponse.redirect(`${origin}${destination}`);
}
