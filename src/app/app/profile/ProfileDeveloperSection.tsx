import { listApiKeysForScope } from "@/lib/api-keys/actions";
import { ApiKeysPanel } from "@/components/developer/ApiKeysPanel";

export async function ProfileDeveloperSection() {
  const keys = await listApiKeysForScope(null);

  return (
    <ApiKeysPanel
      keys={keys}
      description="Personal API keys access only your personal workspace data (org_id null)."
    />
  );
}
