export const DOCUMENT_TYPES = ["pay_advice", "invoice"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "draft",
  "in_progress",
  "verified",
  "corrections_needed",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type GenerateDocumentInput = {
  timesheetId: string;
  type: DocumentType;
  gstEnabled: boolean;
  gstRate: number;
};
