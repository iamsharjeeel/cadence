"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { submitExpense } from "./actions";

export function ExpenseSubmitForm({ defaultCurrency }: { defaultCurrency: string }) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    const result = await submitExpense({
      amount: Number(data.get("amount")),
      currency: String(data.get("currency") ?? defaultCurrency),
      description: String(data.get("description") ?? ""),
      expenseDate: String(data.get("expense_date") ?? ""),
    });
    setPending(false);
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Date"
        name="expense_date"
        type="date"
        required
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <Input
        label="Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        required
        placeholder="0.00"
      />
      <Input
        label="Currency"
        name="currency"
        defaultValue={defaultCurrency}
        maxLength={3}
        className="uppercase"
      />
      <Input
        label="Description"
        name="description"
        required
        placeholder="What was this expense for?"
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Submit expense
        </Button>
      </div>
    </form>
  );
}
