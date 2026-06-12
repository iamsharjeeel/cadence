"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the server-rendered employees list while pending invites exist,
 * so newly accepted sign-ups appear without a manual full page reload.
 */
export function EmployeesListRefresh({
  hasPendingInvites,
}: {
  hasPendingInvites: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!hasPendingInvites) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [hasPendingInvites, router]);

  return null;
}
