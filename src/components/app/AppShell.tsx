"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { PageTransition } from "@/components/motion/PageTransition";
import type { Profile } from "@/types/db";

export function AppShell({
  profile,
  orgName,
  children,
}: {
  profile: Profile;
  orgName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/app/onboarding");

  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-bg">
        <main className="w-full px-5 py-10 sm:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar role={profile.role} orgName={orgName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="flex-1 px-5 py-8 sm:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
