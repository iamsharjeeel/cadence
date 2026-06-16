import { listApiKeysForScope } from "@/lib/api-keys/actions";
import { listWebhookEndpoints } from "@/lib/webhooks/actions";
import { ApiKeysPanel } from "@/components/developer/ApiKeysPanel";
import { WebhookEndpointsPanel } from "@/components/developer/WebhookEndpointsPanel";

export async function OrgDeveloperSettings({
  orgId,
}: {
  orgId: string;
  isOwner?: boolean;
}) {
  const [keys, endpoints] = await Promise.all([
    listApiKeysForScope(orgId),
    listWebhookEndpoints(orgId),
  ]);

  return (
    <div className="space-y-4">
      <ApiKeysPanel
        keys={keys}
        orgId={orgId}
        description="Org-scoped API keys return data for this organization."
      />
      <WebhookEndpointsPanel endpoints={endpoints} orgId={orgId} />
    </div>
  );
}
