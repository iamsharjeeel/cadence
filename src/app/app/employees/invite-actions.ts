"use server";

import { revalidatePath } from "next/cache";

import { getWorkspaceContext } from "@/lib/workspace";
import { writeAudit } from "@/lib/audit";
import { getOrgName } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient, getResendFromEmail } from "@/lib/resend";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import type { UserRole } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

export type InviteRoleOption = "owner" | "admin" | "employee";

const INVITE_ROLES: InviteRoleOption[] = ["owner", "admin", "employee"];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function inviteMember(payload: {
  email: string;
  role: InviteRoleOption;
}): Promise<ActionResult> {
  // Track C: authorize against the ACTIVE workspace's true role (owner/admin),
  // not the now-vestigial profiles.role.
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };
  const orgId = ctx.activeOrgId;
  const wsRole = ctx.workspaceRole;
  const actorId = ctx.realProfile.id;
  if (!orgId || (wsRole !== "owner" && wsRole !== "admin")) {
    return {
      ok: false,
      message: "Switch to an organization you own or manage to invite members.",
    };
  }

  const email = payload.email.trim().toLowerCase();
  const role = payload.role;

  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!INVITE_ROLES.includes(role)) {
    return { ok: false, message: "Invalid role." };
  }

  // Admins can only invite employees; owners can invite any role.
  if (wsRole === "admin" && role !== "employee") {
    return { ok: false, message: "Managers can only invite employees." };
  }

  const db = createAdminClient();

  const { data: existingProfile } = await db
    .from("profiles")
    .select("id")
    .ilike("email", escapeIlike(email))
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (existingMember) {
      return {
        ok: false,
        message: "This person is already a member of this organization.",
      };
    }
  }

  const { data: pendingInvite } = await db
    .from("org_invites")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", escapeIlike(email))
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (pendingInvite) {
    return { ok: false, message: "An invite is already pending for this email." };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { error: insertErr } = await db.from("org_invites").insert({
    org_id: orgId,
    email,
    role: role as UserRole,
    invited_by: actorId,
    expires_at: expiresAt.toISOString(),
  });

  if (insertErr) {
    console.error("[invite] insert failed:", insertErr.message);
    return { ok: false, message: "Couldn't create invite. Try again." };
  }

  const orgName = await getOrgName(orgId);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cadence-eta-five.vercel.app";
  const loginUrl = `${appUrl.replace(/\/$/, "")}/login`;

  try {
    const resend = getResendClient();
    const { error: emailErr } = await resend.emails.send({
      from: getResendFromEmail(),
      to: email,
      subject: `You're invited to ${orgName} on Cadence`,
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #14151A;">
          <p style="font-size: 18px; font-weight: 600; color: #B8862F;">Cadence</p>
          <p style="font-size: 16px; font-weight: 600;">You're invited to join ${orgName}</p>
          <p style="font-size: 14px; line-height: 1.6; color: #6B6F76;">
            Sign in with Google using <strong>${email}</strong> to get started.
            You'll land in onboarding to set up your profile.
          </p>
          <p style="margin: 24px 0;">
            <a href="${loginUrl}" style="display: inline-block; background: #B8862F; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px;">
              Accept invite
            </a>
          </p>
          <p style="font-size: 12px; color: #6B6F76;">This invite expires in 14 days.</p>
        </div>
      `,
    });

    if (emailErr) {
      console.error("[invite] resend failed:", emailErr);
      await db
        .from("org_invites")
        .delete()
        .eq("org_id", orgId)
        .ilike("email", escapeIlike(email))
        .is("accepted_at", null);
      return {
        ok: false,
        message: "Invite saved but email failed to send. Check Resend configuration.",
      };
    }
  } catch (e) {
    console.error("[invite] resend error:", e);
    await db
      .from("org_invites")
      .delete()
      .eq("org_id", orgId)
      .ilike("email", escapeIlike(email))
      .is("accepted_at", null);
    return {
      ok: false,
      message: "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  await writeAudit({
    actorId: actorId,
    orgId: orgId,
    action: "member_invited",
    entity: "org_invites",
    payload: { email, role, org_id: orgId },
  });

  void dispatchWebhookEvent(orgId, {
    type: "member.invited",
    data: {
      email,
      role,
      org_id: orgId,
      invited_by: actorId,
    },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `Invite sent to ${email}.` };
}
