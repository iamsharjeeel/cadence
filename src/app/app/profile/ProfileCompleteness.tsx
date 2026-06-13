"use client";

import { motion } from "framer-motion";

import type { Profile } from "@/types/db";
import { cn } from "@/lib/utils";

export type ProfileField =
  | "full_name"
  | "address"
  | "job_title"
  | "start_date"
  | "bank_details"
  | "tax_id"
  | "emergency_contact";

const FIELD_LABELS: Record<ProfileField, string> = {
  full_name: "Full name",
  address: "Address",
  job_title: "Job title",
  start_date: "Start date",
  bank_details: "Bank details",
  tax_id: "Tax ID",
  emergency_contact: "Emergency contact",
};

const FIELD_ANCHORS: Record<ProfileField, string> = {
  full_name: "section-personal",
  address: "section-banking",
  job_title: "section-employment",
  start_date: "section-employment",
  bank_details: "section-banking",
  tax_id: "section-banking",
  emergency_contact: "section-emergency",
};

export function computeProfileCompleteness(profile: Profile): {
  percent: number;
  missing: ProfileField[];
} {
  const checks: { field: ProfileField; done: boolean }[] = [
    { field: "full_name", done: !!profile.full_name?.trim() },
    { field: "address", done: !!profile.address?.trim() },
    { field: "job_title", done: !!profile.job_title?.trim() },
    { field: "start_date", done: !!profile.start_date },
    {
      field: "bank_details",
      done: !!(
        profile.bank_name?.trim() &&
        profile.bank_account_name?.trim() &&
        profile.bank_account_number &&
        profile.bank_bsb_swift
      ),
    },
    { field: "tax_id", done: !!profile.tax_id?.trim() },
    {
      field: "emergency_contact",
      done: !!(
        profile.emergency_name?.trim() &&
        profile.emergency_phone?.trim() &&
        profile.emergency_relation?.trim()
      ),
    },
  ];

  const done = checks.filter((c) => c.done).length;
  const total = checks.length;
  const missing = checks.filter((c) => !c.done).map((c) => c.field);

  return {
    percent: Math.round((done / total) * 100),
    missing,
  };
}

export function ProfileCompleteness({ profile }: { profile: Profile }) {
  const { percent, missing } = computeProfileCompleteness(profile);

  if (percent === 100) {
    return (
      <p className="mb-6 text-sm font-medium text-[var(--accent-strong)]">
        Profile complete ✓
      </p>
    );
  }

  function scrollTo(field: ProfileField) {
    document
      .getElementById(FIELD_ANCHORS[field])
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Profile {percent}% complete</span>
        <span className="tabular font-medium text-[var(--accent-strong)]">
          {percent}%
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-chip bg-surface-low">
        <motion.div
          className="h-full rounded-chip bg-accent-mid"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {missing.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => scrollTo(field)}
              className={cn(
                "rounded-full border bg-surface px-3 py-1 text-xs font-medium text-[var(--accent-strong)]",
                "transition-colors hover:bg-[var(--accent-soft)]",
              )}
            >
              + Add {FIELD_LABELS[field].toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
