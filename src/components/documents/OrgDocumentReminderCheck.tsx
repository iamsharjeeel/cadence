"use client";

import { useEffect } from "react";

import { checkOrgDocumentAckReminders } from "@/app/app/org-documents/actions";

export function OrgDocumentReminderCheck() {
  useEffect(() => {
    checkOrgDocumentAckReminders();
  }, []);
  return null;
}
