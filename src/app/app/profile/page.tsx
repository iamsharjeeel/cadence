import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Badge, RolePill, StatusPill } from "@/components/ui/Badge";
import { requireActiveProfile } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";
import { ProfileHashScroll } from "./ProfileHashScroll";
import { maskSensitive } from "@/lib/bank-crypto";
import { ProfileBankingForm } from "./ProfileBankingForm";
import { ProfileNameForm } from "./ProfileNameForm";
import { AvatarPickerSection } from "./AvatarPickerSection";
import { ProfileEmploymentForm } from "./ProfileEmploymentForm";
import { ProfileRateForm } from "./ProfileRateForm";
import { ProfileEmergencyForm } from "./ProfileEmergencyForm";
import { ProfileCompleteness } from "./ProfileCompleteness";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const ctx = await getWorkspaceContext();
  const profile = await requireActiveProfile();
  const inOrg = Boolean(ctx?.activeOrgId);

  return (
    <div>
      <ProfileHashScroll />
      <PageHeader
        title="Your profile"
        description={
          inOrg
            ? "Update your personal and employment details. Role and status are managed by your organization."
            : "Update your personal and employment details."
        }
      />

      <ProfileCompleteness profile={profile} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card id="section-personal" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Personal details</CardTitle>
            <CardDescription>Your display name and email.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <AvatarPickerSection
              name={profile.full_name}
              email={profile.email}
              avatarUrl={profile.avatar_url ?? null}
            />
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
              {inOrg
                ? "Role and status are managed by a manager. You can set your own rate."
                : "Set your own rate."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field label="Role">
              {ctx?.isPersonal && !ctx.isSuperadmin ? (
                <Badge tone="pending" className="text-[12px]">
                  Admin
                </Badge>
              ) : (
                <RolePill role={profile.role} />
              )}
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
