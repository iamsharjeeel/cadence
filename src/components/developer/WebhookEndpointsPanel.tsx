"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Copy, Plus, Trash2, Webhook } from "lucide-react";

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
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  retryWebhookDeliveryAction,
  toggleWebhookEndpoint,
} from "@/lib/webhooks/actions";
import { generateWebhookSecret } from "@/lib/webhooks/secret";
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookDeliverySummaryRow,
  type WebhookEndpointRow,
} from "@/types/api";
import { cn } from "@/lib/utils";

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + "…";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DeliveriesExpander({ endpointId }: { endpointId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDeliverySummaryRow[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function toggle() {
    if (!open && deliveries === null) {
      setLoading(true);
      const rows = await listWebhookDeliveries(endpointId);
      setDeliveries(rows);
      setLoading(false);
    }
    setOpen((v) => !v);
  }

  async function retry(id: string) {
    setRetryingId(id);
    const result = await retryWebhookDeliveryAction(id);
    toast(result.message, result.ok ? "success" : "error");
    const rows = await listWebhookDeliveries(endpointId);
    setDeliveries(rows);
    setRetryingId(null);
  }

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
        Recent deliveries
        {loading ? "…" : ""}
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {(deliveries ?? []).length === 0 ? (
            <li className="text-xs text-muted">No deliveries yet.</li>
          ) : (
            (deliveries ?? []).map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--line)] px-2 py-1.5 text-xs"
              >
                <span className="font-mono text-ink">{d.event_type ?? "—"}</span>
                <Badge tone={d.status === "delivered" ? "success" : "danger"}>
                  {d.status}
                </Badge>
                <span className="text-muted">{formatTimestamp(d.created_at)}</span>
                {d.response_status != null && (
                  <span className="text-muted">HTTP {d.response_status}</span>
                )}
                {d.status === "failed" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => retry(d.id)}
                    disabled={retryingId === d.id}
                  >
                    {retryingId === d.id ? "Retrying…" : "Retry"}
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function WebhookEndpointsPanel({
  endpoints,
  orgId,
}: {
  endpoints: WebhookEndpointRow[];
  orgId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpointRow | null>(
    null,
  );
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENT_TYPES]);
  const [secret, setSecret] = useState(() => generateWebhookSecret());
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleEvent(event: string) {
    setEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    );
  }

  function regenerateSecret() {
    setSecret(generateWebhookSecret());
  }

  async function copySecret(value: string) {
    await navigator.clipboard.writeText(value);
    toast("Copied to clipboard", "success");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createWebhookEndpoint({
      orgId,
      url,
      description,
      events,
      secret,
    });
    setSubmitting(false);
    if (!result.ok || !("secret" in result)) {
      toast("message" in result ? result.message : "Couldn't create endpoint.", "error");
      return;
    }
    setCreatedSecret(result.secret);
    router.refresh();
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreateOpen(false);
    setUrl("");
    setDescription("");
    setEvents([...WEBHOOK_EVENT_TYPES]);
    setSecret(generateWebhookSecret());
    setCreatedSecret(null);
  }

  function handleToggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleWebhookEndpoint(id, enabled);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    const result = await deleteWebhookEndpoint(deleteTarget.id);
    setSubmitting(false);
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      setDeleteTarget(null);
      router.refresh();
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Webhook endpoints</CardTitle>
          <CardDescription>
            Receive HTTP POST notifications when events occur in your organization.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add endpoint
        </Button>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <p className="text-sm text-muted">No webhook endpoints configured.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {endpoints.map((ep) => (
              <li key={ep.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-ink" title={ep.url}>
                      {truncateUrl(ep.url)}
                    </p>
                    {ep.description && (
                      <p className="mt-1 text-sm text-muted">{ep.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(ep.events.length === 0
                        ? WEBHOOK_EVENT_TYPES
                        : ep.events
                      ).map((ev) => (
                        <Badge key={ev} tone="muted">
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ep.enabled}
                      disabled={pending}
                      onClick={() => handleToggle(ep.id, !ep.enabled)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        ep.enabled ? "bg-[var(--accent)]" : "bg-[var(--line)]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          ep.enabled && "translate-x-5",
                        )}
                      />
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(ep)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <DeliveriesExpander endpointId={ep.id} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <MotionModal
        open={createOpen}
        onClose={closeCreateModal}
        panelClassName="max-w-lg"
      >
        {createdSecret ? (
          <>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-[var(--accent)]" aria-hidden />
              <h2 className="font-display text-lg font-semibold tracking-tightest">
                Endpoint created
              </h2>
            </div>
            <p className="mt-2 text-sm text-[var(--danger)]">
              Save this signing secret now — it will not be shown again.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--line)] bg-[var(--bg)] p-3">
              <code className="flex-1 break-all font-mono text-xs">
                {createdSecret}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copySecret(createdSecret)}
              >
                <Copy className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={closeCreateModal}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold tracking-tightest">
              Add webhook endpoint
            </h2>
            <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-4">
              <Input
                label="Endpoint URL"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks/cadence"
                required
              />
              <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. HR system integration"
              />
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">Events</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEBHOOK_EVENT_TYPES.map((ev) => (
                    <label
                      key={ev}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={events.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                        className="rounded border-[var(--line)]"
                      />
                      <span className="font-mono text-xs">{ev}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Signing secret</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={regenerateSecret}
                  >
                    Regenerate
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--line)] bg-[var(--bg)] p-3">
                  <code className="flex-1 break-all font-mono text-xs">{secret}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => copySecret(secret)}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeCreateModal}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || events.length === 0}>
                  {submitting ? "Saving…" : "Add endpoint"}
                </Button>
              </div>
            </form>
          </>
        )}
      </MotionModal>

      <MotionModal
        open={!!deleteTarget}
        onClose={() => !submitting && setDeleteTarget(null)}
        panelClassName="max-w-md"
      >
        <h2 className="font-display text-lg font-semibold tracking-tightest">
          Delete webhook endpoint?
        </h2>
        <p className="mt-2 text-sm text-muted">
          {deleteTarget?.url} will stop receiving events immediately.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setDeleteTarget(null)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={submitting}>
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </MotionModal>
    </Card>
  );
}
