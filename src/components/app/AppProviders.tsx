"use client";

import { OrgSettingsProvider } from "@/contexts/OrgSettingsContext";
import { TimerProvider } from "@/contexts/TimerContext";
import { FloatingTimer } from "@/components/timer/FloatingTimer";

export function AppProviders({
  orgId,
  canLoadOrgSettings,
  userId,
  children,
}: {
  orgId: string | null;
  canLoadOrgSettings: boolean;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <OrgSettingsProvider orgId={orgId} canLoad={canLoadOrgSettings}>
      <TimerProvider>
        {children}
        <FloatingTimer userId={userId} />
      </TimerProvider>
    </OrgSettingsProvider>
  );
}
