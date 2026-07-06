# Changelog

## 2026-07-06

- Init audit: `npm install`, Vercel env pull (`.env.local`), typecheck/lint/build pass
- Add `ASANA_REDIRECT_URI` to `.env.local.example`
- Merge `CADENCE_HANDOVER.md` + `HANDOVER.md` into single `HANDOVER.md`; delete duplicate file
- Backfill F4 migration `20260701000001_f4_api_keys_webhook_endpoints.sql`
- Live DB audit via `scripts/live-db-audit.mjs` (F4 tables exist; anon RLS blocked)
- SECURITY_AUDIT.md: 2026-07-06 re-verification with live probe results
- Add local ↔ cloud sync scripts and README workflow for keeping `~/Desktop/cadence` aligned with GitHub.
