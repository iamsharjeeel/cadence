"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { generateApiKey, revokeApiKey } from "@/lib/api-keys/actions";
import type { ApiKeyRow } from "@/types/api";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ApiKeysPanel({
  keys,
  orgId,
  title = "API keys",
  description = "Generate keys for the Cadence REST API. Keys are shown once on creation.",
}: {
  keys: ApiKeyRow[];
  orgId?: string | null;
  title?: string;
  description?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [name, setName] = useState("");
  const [permission, setPermission] = useState<"read_only" | "full">("full");
  const [pending, setPending] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const activeCount = keys.filter((k) => !k.revoked_at).length;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await generateApiKey(name, orgId ?? undefined, permission);
    setPending(false);
    if (!result.ok || !("key" in result)) {
      toast("message" in result ? result.message : "Couldn't generate API key.", "error");
      return;
    }
    setCreatedKey(result.key.fullKey);
    setName("");
    router.refresh();
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setPending(true);
    const result = await revokeApiKey(revokeTarget.id);
    setPending(false);
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      setRevokeTarget(null);
      router.refresh();
    }
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    toast("Copied to clipboard", "success");
  }

  function closeCreateModal() {
    if (pending) return;
    setCreateOpen(false);
    setCreatedKey(null);
    setName("");
    setPermission("full");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={activeCount >= 10}
        >
          <KeyRound className="h-4 w-4" aria-hidden />
          Generate new key
        </Button>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-sm text-muted">No API keys yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink">
                    {key.key_prefix}…
                    <span className="ml-2 font-sans text-muted">{key.name}</span>
                    {key.permission === "read_only" ? (
                      <span className="ml-2 rounded bg-[var(--line)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        Read only
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Created {formatDate(key.created_at)}
                    {key.last_used_at
                      ? ` · Last used ${formatDate(key.last_used_at)}`
                      : " · Never used"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {key.revoked_at ? (
                    <Badge tone="muted">Revoked</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRevokeTarget(key)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Revoke
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          {activeCount}/10 active keys
        </p>
      </CardContent>

      <MotionModal
        open={createOpen}
        onClose={closeCreateModal}
        panelClassName="max-w-md"
      >
        {createdKey ? (
          <>
            <h2 className="font-display text-lg font-semibold tracking-tightest">
              API key created
            </h2>
            <p className="mt-2 text-sm text-[var(--danger)]">
              This key will not be shown again. Copy it now and store it securely.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--line)] bg-[var(--bg)] p-3">
              <code className="flex-1 break-all font-mono text-xs">{createdKey}</code>
              <Button size="sm" variant="secondary" onClick={copyKey}>
                <Copy className="h-4 w-4" aria-hidden />
                Copy
              </Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={closeCreateModal}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold tracking-tightest">
              Generate API key
            </h2>
            <p className="mt-1 text-sm text-muted">
              Name this key so you can tell it apart later.
            </p>
            <form onSubmit={handleGenerate} className="mt-6 flex flex-col gap-4">
              <Input
                label="Key name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production integration"
                required
                maxLength={100}
              />
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-ink">Permission</span>
                <select
                  value={permission}
                  onChange={(e) =>
                    setPermission(e.target.value as "read_only" | "full")
                  }
                  className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-surface px-3 text-sm"
                >
                  <option value="full">Full access (read + write)</option>
                  <option value="read_only">Read only</option>
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeCreateModal}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Generating…" : "Generate"}
                </Button>
              </div>
            </form>
          </>
        )}
      </MotionModal>

      <MotionModal
        open={!!revokeTarget}
        onClose={() => !pending && setRevokeTarget(null)}
        panelClassName="max-w-md"
      >
        <h2 className="font-display text-lg font-semibold tracking-tightest">
          Revoke API key?
        </h2>
        <p className="mt-2 text-sm text-muted">
          <span className="font-mono">{revokeTarget?.key_prefix}…</span> (
          {revokeTarget?.name}) will stop working immediately.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setRevokeTarget(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRevoke} disabled={pending}>
            {pending ? "Revoking…" : "Revoke key"}
          </Button>
        </div>
      </MotionModal>
    </Card>
  );
}
