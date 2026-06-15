"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { NavigationProvider } from "@/components/app/NavigationProvider";
import { PageTransition } from "@/components/motion/PageTransition";
import type {
  SwitcherMembership,
  SwitcherInvite,
} from "@/components/app/WorkspaceSwitcher";
import type { NavContext } from "@/components/app/nav";
import type { Profile } from "@/types/db";

export type SwitcherData = {
  activeOrgId: string | null;
  isSuperadmin: boolean;
  memberships: SwitcherMembership[];
  pendingInvites: SwitcherInvite[];
  currentLabel: string;
  currentSublabel: string;
  currentLogoName: string;
  currentLogoUrl: string | null;
};

export function AppShell({
  profile,
  navContext,
  switcher,
  children,
}: {
  profile: Profile;
  navContext: NavContext;
  switcher: SwitcherData;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/app/onboarding");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isOnboarding) {
    return (
      <NavigationProvider>
        <div className="min-h-screen bg-background">
          <main className="w-full px-5 py-10 sm:px-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </NavigationProvider>
    );
  }

  return (
    <NavigationProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          navContext={navContext}
          switcher={switcher}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            profile={profile}
            navContext={navContext}
            mobileNavOpen={mobileNavOpen}
            onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
          />
          <main className="flex-1 bg-background px-5 py-8 sm:px-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </NavigationProvider>
  );
}
