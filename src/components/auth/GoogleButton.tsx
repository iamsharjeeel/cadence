"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      toast(error.message, "error");
      setLoading(false);
    }
    // On success the browser is redirected to Google — no need to reset state.
  }

  return (
    <Button
      onClick={signIn}
      disabled={loading}
      className="w-full"
      size="md"
      aria-label="Continue with Google"
    >
      <GoogleMark />
      {loading ? "Connecting…" : "Continue with Google"}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#FFC107"
        d="M17.6 9.2H9v3.5h4.9A4.9 4.9 0 0 1 4.1 9 4.9 4.9 0 0 1 9 4.1c1.2 0 2.3.5 3.2 1.2l2.5-2.5A8.5 8.5 0 1 0 9 17.5c4.9 0 8.5-3.5 8.5-8.5 0-.6-.1-1.2-.2-1.8Z"
      />
      <path
        fill="#FF3D00"
        d="m1.3 5.3 2.9 2.1A4.9 4.9 0 0 1 9 4.1c1.2 0 2.3.5 3.2 1.2l2.5-2.5A8.5 8.5 0 0 0 1.3 5.3Z"
      />
      <path
        fill="#4CAF50"
        d="M9 17.5a8.5 8.5 0 0 0 5.7-2.2l-2.6-2.2A4.9 4.9 0 0 1 4.2 11l-2.9 2.2A8.5 8.5 0 0 0 9 17.5Z"
      />
      <path
        fill="#1976D2"
        d="M17.6 9.2H9v3.5h4.9a4.9 4.9 0 0 1-1.7 2.3l2.6 2.2c-.2.2 2.7-2 2.7-6.2 0-.6-.1-1.2-.2-1.8Z"
      />
    </svg>
  );
}
