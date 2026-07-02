"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { PERIOD_CADENCES } from "@/types/db";
import { titleCase } from "@/lib/utils";
import { COMMON_CURRENCIES } from "@/lib/constants";
import { formatAllowedDomains, normalizeAllowedDomains } from "@/lib/org-utils";
import type { Organization } from "@/types/db";
import {
  updateOrgDetails,
  updateOrgDomains,
  uploadOrgLogo,
  suspendAllEmployees,
  type ActionResult,
} from "./actions";

function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function useActionToast(state: ActionResult | null) {
  const { toast } = useToast();
  const last = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);
}

export function GeneralSettingsTab({
  org,
  isAdmin,
  orgIdField,
}: {
  org: Organization;
  isAdmin: boolean;
  orgIdField?: string;
}) {
  const [detailsState, detailsAction] = useFormState(updateOrgDetails, null);
  const [domainsState, domainsAction] = useFormState(updateOrgDomains, null);
  const [logoState, logoAction] = useFormState(uploadOrgLogo, null);
  const [suspendState, suspendAction] = useFormState(suspendAllEmployees, null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState(org.logo_url);

  useActionToast(detailsState);
  useActionToast(domainsState);
  useActionToast(logoState);
  useActionToast(suspendState);

  useEffect(() => {
    if (logoState?.ok && logoState.logoUrl) {
      setLogoPreview(logoState.logoUrl);
    } else if (logoState?.ok) {
      setLogoPreview(org.logo_url);
    }
  }, [logoState, org.logo_url]);

  const hiddenOrg = orgIdField ? (
    <input type="hidden" name="org_id" value={orgIdField} />
  ) : null;

  const currencyOptions = Array.isArray(COMMON_CURRENCIES)
    ? COMMON_CURRENCIES.map((c) => ({ label: c, value: c }))
    : [];
  const cadenceOptions = Array.isArray(PERIOD_CADENCES)
    ? PERIOD_CADENCES.map((c) => ({
        label: titleCase(c),
        value: c,
      }))
    : [];

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
        <h3 className="font-display text-base font-semibold text-ink">
          Organisation details
        </h3>
        <p className="mt-1 text-sm text-muted">
          Name, currency, and default pay period cadence.
        </p>
        <form action={detailsAction} className="mt-4 flex flex-col gap-4">
          {hiddenOrg}
          <Input
            label="Organization name"
            name="name"
            defaultValue={org.name}
            maxLength={80}
            required
          />
          <div className="relative">
            <Input
              label="Slug"
              value={`/${org.slug}`}
              readOnly
              disabled
              hint="Fixed after creation."
            />
            <Lock className="absolute right-3 top-9 h-4 w-4 text-muted" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Base currency"
              name="base_currency"
              defaultValue={org.base_currency}
              options={currencyOptions}
            />
            <Select
              label="Default pay period cadence"
              name="default_cadence"
              defaultValue={org.default_cadence}
              options={cadenceOptions}
            />
          </div>
          <div>
            <SaveButton label="Save details" />
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
        <h3 className="font-display text-base font-semibold text-ink">
          Allowed domains
        </h3>
        <p className="mt-1 text-sm text-muted">
          Stored for reference only. Members join your organization via email
          invites — not by signing in from a matching domain.
        </p>
        {normalizeAllowedDomains(org.allowed_domains).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {normalizeAllowedDomains(org.allowed_domains).map((d) => (
              <Badge key={d} tone="accent">
                {d}
              </Badge>
            ))}
          </div>
        )}
        <form action={domainsAction} className="mt-4 flex flex-col gap-4">
          {hiddenOrg}
          <Input
            label="Domains"
            name="allowed_domains"
            defaultValue={formatAllowedDomains(org.allowed_domains)}
            placeholder="acme.com, acme.io"
            hint="Comma or space separated. Removing a domain with active employees is blocked."
          />
          <div>
            <SaveButton label="Save domains" />
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
        <h3 className="font-display text-base font-semibold text-ink">Logo</h3>
        <p className="mt-1 text-sm text-muted">
          PNG or JPG, max 2MB. Shown in the sidebar and on generated PDFs.
        </p>
        {logoPreview && (
          <img
            src={logoPreview}
            alt="Organization logo"
            loading="lazy"
            className="mt-4 h-16 w-16 rounded-lg border bg-[var(--line)] object-contain"
          />
        )}
        <form
          action={logoAction}
          encType="multipart/form-data"
          className="mt-4 flex flex-col gap-4"
        >
          {hiddenOrg}
          <Input
            label="Upload logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg"
          />
          <div>
            <SaveButton label="Upload logo" />
          </div>
        </form>
      </section>

      {isAdmin && (
        <section className="rounded-[var(--radius-card)] bg-[#FFF0F0] p-6 shadow-card dark:bg-[#1A0A0A]">
          <h3 className="font-display text-base font-semibold text-[var(--danger)]">
            Danger zone
          </h3>
          <p className="mt-1 text-sm text-muted">
            Suspend all non-admin employees in your organization. They will lose
            access until reactivated.
          </p>
          <Button
            variant="danger"
            size="sm"
            className="mt-4"
            onClick={() => setSuspendOpen(true)}
          >
            Suspend all employees
          </Button>
          {suspendOpen && (
            <MotionModal
              open
              onClose={() => setSuspendOpen(false)}
              panelClassName="max-w-md"
            >
              <h4 className="font-display text-base font-semibold text-ink">
                Suspend all employees?
              </h4>
              <p className="mt-2 text-sm text-muted">
                This will suspend every active employee in your organization.
                Admins are not affected.
              </p>
              <form
                action={suspendAction}
                className="mt-4 flex justify-end gap-2"
                onSubmit={() => setSuspendOpen(false)}
              >
                <input type="hidden" name="confirm" value="yes" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSuspendOpen(false)}
                >
                  Cancel
                </Button>
                <SaveButton label="Confirm suspend" />
              </form>
            </MotionModal>
          )}
        </section>
      )}
    </div>
  );
}
