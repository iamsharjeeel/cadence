import "server-only";

import { Resend } from "resend";

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  return new Resend(key);
}

export function getResendFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "hello@cadencemail.s1mplesolutions.cc"
  );
}
