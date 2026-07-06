"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { fieldBase } from "@/components/ui/Input";
import { cn, formatDate } from "@/lib/utils";
import type { ExpenseRow } from "./actions";
import { approveExpense, rejectExpense } from "./actions";

export function ExpenseAdminView({ pending }: { pending: ExpenseRow[] }) {
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  async function approve(id: string) {
    setActingId(id);
    try {
      const result = await approveExpense(id);
      toast(result.message, result.ok ? "success" : "error");
    } finally {
      setActingId(null);
    }
  }

  async function reject(id: string) {
    if (!rejectNote.trim()) {
      toast("Rejection note required.", "error");
      return;
    }
    setActingId(id);
    try {
      const result = await rejectExpense(id, rejectNote);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setRejectId(null);
        setRejectNote("");
      }
    } finally {
      setActingId(null);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Pending expenses</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {pending.length === 0 ? (
          <div className="px-6 py-6">
            <EmptyState
              title="You're all caught up"
              description="No expense submissions waiting for review."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {pending.map((expense) => (
              <li key={expense.id} className="px-6 py-4">
                <p className="text-sm font-medium">{expense.employee_name}</p>
                <p className="text-sm text-muted">
                  {formatDate(expense.expense_date)} · {expense.currency}{" "}
                  {Number(expense.amount).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted">{expense.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve(expense.id)}
                    disabled={actingId === expense.id}
                  >
                    {actingId === expense.id ? "Approving…" : "Approve"}
                  </Button>
                  {rejectId !== expense.id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejectId(expense.id)}
                    >
                      Reject
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Rejection note"
                        className={cn(fieldBase, "h-9 w-48 text-sm")}
                      />
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => reject(expense.id)}
                        disabled={actingId === expense.id}
                      >
                        {actingId === expense.id ? "Rejecting…" : "Confirm"}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
