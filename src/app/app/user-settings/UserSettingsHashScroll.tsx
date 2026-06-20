"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Scrolls to a settings section hash after client navigation. */
export function UserSettingsHashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/app/user-settings") return;

    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const id = decodeURIComponent(hash.slice(1));
    const scrollToTarget = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    requestAnimationFrame(scrollToTarget);
    const retry = window.setTimeout(scrollToTarget, 150);
    return () => window.clearTimeout(retry);
  }, [pathname]);

  return null;
}
