import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { RolePill, StatusPill } from "@/components/ui/Badge";
import { requireActiveProfile } from "@/lib/auth";
import { getAsanaConnectionStatus } from "@/lib/asana/connection";
import { createClient } from "@/lib/supabase/server";
import type { AsanaImportedProject } from "@/types/db";
import { ConnectedAccountsSection } from "./ConnectedAccountsSection";
import { ProfileHashScroll } from "./ProfileHashScroll";
import { maskSensitive } from "@/lib/bank-crypto";
import { ProfileBankingForm } from "./ProfileBankingForm";
import { ProfileNameForm } from "./ProfileNameForm";
import { ProfileEmploymentForm } from "./ProfileEmploymentForm";
import { ProfileRateForm } from "./ProfileRateForm";
import { ProfileEmergencyForm } from "./ProfileEmergencyForm";
import { ProfileCompleteness } from "./ProfileCompleteness";

export const metadata: Metadata = { title: "Profile" };

type ProfilePageProps = {
  searchParams?: { asana?: string };
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const profile = await requireActiveProfile();
  const [connection, importedProjects] = await Promise.all([
    getAsanaConnectionStatus(profile.id),
    loadImportedAsanaProjects(profile.id),
  ]);

  const asanaFlash =
    searchParams?.asana === "connected"
      ? "connected"
      : searchParams?.asana === "error"
        ? "error"
        : null;

  return (
    <div>
      <ProfileHashScroll />
      <PageHeader
        title="Your profile"
        description="Update your personal and employment details. Role and status are managed by your administrator."
      />

      <ProfileCompleteness profile={profile} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="section-personal" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Personal details</CardTitle>
            <CardDescription>Your display name and email.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileNameForm
              defaultName={profile.full_name ?? ""}
              email={profile.email}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment</CardTitle>
            <CardDescription>
              Role and status are managed by an admin. You can set your own rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field label="Role">
              <RolePill role={profile.role} />
            </Field>
            <Field label="Status">
              <StatusPill status={profile.status} />
            </Field>
            <Field label="Rate">
              <ProfileRateForm
                rate={profile.rate}
                rateType={profile.rate_type}
                currency={profile.currency}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card id="section-employment" className="mt-4 scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Job details</CardTitle>
          <CardDescription>Your role and start date.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEmploymentForm
            jobTitle={profile.job_title ?? ""}
            startDate={profile.start_date ?? ""}
          />
        </CardContent>
      </Card>

      <Card id="section-banking" className="mt-4 scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Banking &amp; tax</CardTitle>
          <CardDescription>
            Used on contractor invoices. Sensitive fields are encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileBankingForm
            defaults={{
              bank_name: profile.bank_name ?? "",
              bank_account_name: profile.bank_account_name ?? "",
              tax_id: profile.tax_id ?? "",
              address: profile.address ?? "",
              payment_terms_days: profile.payment_terms_days ?? 14,
            }}
            accountMasked={maskSensitive(profile.bank_account_number)}
            bsbMasked={maskSensitive(profile.bank_bsb_swift)}
          />
        </CardContent>
      </Card>

      <Card id="section-connected" className="mt-4 scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <CardDescription>
            Link personal integrations. Each user connects their own Asana account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ConnectedAccountsSection
              connection={connection}
              importedProjects={importedProjects}
              flash={asanaFlash}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card id="section-emergency" className="mt-4 scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Emergency contact</CardTitle>
          <CardDescription>Someone we can reach in an emergency.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEmergencyForm
            defaults={{
              emergency_name: profile.emergency_name ?? "",
              emergency_phone: profile.emergency_phone ?? "",
              emergency_relation: profile.emergency_relation ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function loadImportedAsanaProjects(
  userId: string,
): Promise<AsanaImportedProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asana_imported_projects")
    .select("*")
    .eq("user_id", userId)
    .order("asana_project_name");

  if (error) {
    console.error("[profile] asana imported projects:", error.message);
    return [];
  }
  return (data ?? []) as AsanaImportedProject[];
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}
