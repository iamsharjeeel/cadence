-- L8: add indexes for columns filtered on every request but previously
-- unindexed. api_keys.user_id is read on each API-key validation and RLS
-- check; webhook_endpoints.org_id is filtered by RLS and every dispatch.
-- Without these, both degrade to a sequential scan as row counts grow.

create index if not exists api_keys_user_id_idx
  on public.api_keys (user_id);

create index if not exists webhook_endpoints_org_id_idx
  on public.webhook_endpoints (org_id);
