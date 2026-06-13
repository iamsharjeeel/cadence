import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runOnboarding } from "@/lib/onboarding";

/**
 * OAuth callback. Exchanges code, runs onboarding, routes by status/onboarding.
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

  if (profile?.status === "suspended") {
    return NextResponse.redirect(`${origin}/login?error=suspended`);
  }

  const destination = profile?.onboarding_complete
    ? "/app/dashboard"
    : "/app/onboarding";

  return NextResponse.redirect(`${origin}${destination}`);
}
