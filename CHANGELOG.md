# Changelog

## 2026-08-07 (Invite + pending-gate review)

- Close pending-status app access hole: layout activates pending users; `requireActiveProfile` requires active
- Stop invite redeem / `accept_invite` from overwriting existing membership roles
- Restore Manager invite/remove/role UI (Employee-only); drop Pending from status controls

## 2026-07-07 (Gmail inbox)

- Gmail OAuth connect/disconnect (`/api/gmail/*`), encrypted tokens, batched full + incremental sync
- `/app/inbox` — synced thread list, filters, thread detail, open in Gmail
- `time_entry_email_threads` join table; link/unlink from time log + metadata on approval queue
- Migration `20260707000001_gmail_inbox.sql`; env `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`

## 2026-07-06 (GitLab mirror)

- `.gitlab-ci.yml` verify pipeline (typecheck, lint, build)
- `scripts/setup-gitlab-remote.sh`; `sync-to-cloud.sh` pushes `origin` + `gitlab`
- GitLab mirror: display name Cadence, path `s1mplesolutions.cc-project` (permanent; no path rename)

## 2026-07-06 (Menu A+B+C)

- Timer entry approval workflow (manager queue, notifications, bulk approve)
- Expenses MVP (`/app/expenses`, org-scoped RLS, approval settings)
- Webhook retries (inline + cron + manual), API v1 rate limits + read-only keys
- L1 anon grant hardening, L2 org-scope trust in aggregators, GitHub + GitLab CI, dual-remote sync
- Migration `menu_abc_features` applied live via MCP
- Post-deploy: re-run `npm run qa:prod`

## 2026-07-06

- Init audit: env, handover merge, F4 migration backfill, commit `9405ec9`
- Supabase MCP live re-verification: C1/C2/M1/Track C/F4 exploit battery passed
- Fix W1: `webhook_deliveries.timesheet_id` nullable (live migration + repo)
- Prod QA: `scripts/qa-prod-api-webhook.mjs` — API v1 + webhook delivery 9/9 pass
- Pushed `main` @ `c94347c` — prod QA script + docs
