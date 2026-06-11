import "server-only";

import { encryptBankField } from "@/lib/bank-crypto";
import type { TablesUpdate } from "@/types/db";

export type BankingInput = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_bsb_swift: string;
  tax_id: string;
  address: string;
  payment_terms_days: number;
};

export function parseBankingFormData(formData: FormData): BankingInput {
  const terms = Number(formData.get("payment_terms_days") ?? 14);
  return {
    bank_name: String(formData.get("bank_name") ?? "").trim(),
    bank_account_name: String(formData.get("bank_account_name") ?? "").trim(),
    bank_account_number: String(formData.get("bank_account_number") ?? "").trim(),
    bank_bsb_swift: String(formData.get("bank_bsb_swift") ?? "").trim(),
    tax_id: String(formData.get("tax_id") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    payment_terms_days: Number.isFinite(terms) && terms > 0 ? terms : 14,
  };
}

/** Builds a DB update payload, encrypting sensitive fields when provided. */
export function bankingToDbPayload(
  input: BankingInput,
  existing?: {
    bank_account_number: string | null;
    bank_bsb_swift: string | null;
  },
): TablesUpdate<"profiles"> {
  const payload: TablesUpdate<"profiles"> = {
    bank_name: input.bank_name || null,
    bank_account_name: input.bank_account_name || null,
    tax_id: input.tax_id || null,
    address: input.address || null,
    payment_terms_days: input.payment_terms_days,
  };

  if (input.bank_account_number) {
    payload.bank_account_number = encryptBankField(input.bank_account_number);
  } else if (existing?.bank_account_number) {
    payload.bank_account_number = existing.bank_account_number;
  } else {
    payload.bank_account_number = null;
  }

  if (input.bank_bsb_swift) {
    payload.bank_bsb_swift = encryptBankField(input.bank_bsb_swift);
  } else if (existing?.bank_bsb_swift) {
    payload.bank_bsb_swift = existing.bank_bsb_swift;
  } else {
    payload.bank_bsb_swift = null;
  }

  return payload;
}
