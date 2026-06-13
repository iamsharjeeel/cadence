"use client";

import { useEffect } from "react";

import { checkAsanaConnectionHealth } from "@/app/app/profile/asana-actions";

/** Opportunistic token health check on dashboard load — no background cron. */
export function AsanaConnectionHealthCheck() {
  useEffect(() => {
    checkAsanaConnectionHealth();
  }, []);
  return null;
}
