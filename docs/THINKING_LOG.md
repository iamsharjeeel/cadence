# Thinking Log — Repo Hygiene Pass on Cadence

> **What this document is.** A mentor's narrated walkthrough of how I ran an
> initialization → audit → testing → debug → security pass on this repository.
> It is written for a less experienced model (or engineer) who can follow
> instructions but hasn't yet internalized *how to decide what to do next*.
> Each phase records not just what I did but **why I did it in that order**,
> **how I made the work cheap**, **what I delegated and how I checked the
> delegate**, and **the dead ends** — because the wrong turns teach more than
> the clean path.
>
> Findings themselves live in `docs/AUDIT_REPORT.md`. This file is about
> *method*. Read them together: the report is the "what," this is the "how."

---

## The three habits that run through everything

Before the phases, the meta-lessons. Every section below is an application of
one of these:

1. **Let the repo tell you how to check it.** Before reading a single line of
   product source, I read `package.json` scripts, the CI workflow, and the
   tsconfig. Those files *are the project's own definition of "correct."* CI
   here runs `typecheck → lint → build`. That is the contract. My testing
   phase reproduces exactly that contract first, because a green local run of
   the same steps is the cheapest possible confidence that the tree is sane.

2. **Search narrows, reading confirms.** With 338 source files you cannot read
   your way to an answer — you'd drown. You `grep` for the risky token
   (`service_role`, `USING (true)`, `dangerouslySetInnerHTML`, `NEXT_PUBLIC_`),
   get a short list of candidate lines, and *then* read those files closely.
   Reading is expensive and precise; searching is cheap and broad. Use them in
   that order, never the reverse.

3. **Never report a finding you haven't tried to refute.** A plausible bug is
   not a bug. When a delegated agent hands me a finding, my job is to play
   prosecutor *against* it: read the cited code, construct the input that
   would trigger it, and look for the guard that makes it safe. Only what
   survives that attack gets written down as CONFIRMED. This is the single
   most important discipline in an audit, because a report full of
   false positives trains the reader to ignore the report.

---

## Phase 0 — Baseline setup

### What I'm about to do and why
Before any analysis I need a known-good starting state: the right branch, a
clean working tree, and a working toolchain. If I skip this and later see a
type error, I won't know whether *I* caused it or it was already there. Ten
seconds of `git status` now saves an hour of "wait, did I break this?" later.

### How to do this efficiently
Batch the read-only fact-gathering. In two parallel shell calls I checked:
branch + status + remotes, and node/npm versions + `package.json`. Then one
`npm ci` (not `npm install` — `ci` is deterministic from the lockfile, which
is what CI itself runs, so my local state matches the pipeline). While that
installed, I read the four files that define "correct" for this repo:
`.github/workflows/ci.yml`, `tsconfig.json`, `.eslintrc.json`, `vercel.json`.

### What I found
- Branch `claude/repo-audit-thinking-log-xgz6eu`, clean tree. Good.
- Node 22 locally; CI pins Node 20. Worth remembering — a build that passes on
  22 could still trip on 20, though for this stack it's low risk.
- `npm ci` succeeded but reported **5 npm advisories (1 moderate, 4 high)**.
  That is the first security finding of the pass, captured before I even
  opened a source file. Lesson: *the install step is itself a scan* — read its
  output, don't just wait for the prompt to return.
- The CI contract is exactly `typecheck → lint → build`, no test step (there
  are no tests). `tsconfig` has `strict: true` — good, it means the typecheck
  is actually load-bearing. `skipLibCheck: true` — normal, keeps typecheck
  fast by trusting `node_modules` types.

### Mistakes / friction
The MCP servers (GitHub, Supabase, etc.) disconnected and reconnected mid-setup,
and my initial `AskUserQuestion` to the user died on a transport error. Lesson
for the junior model: **transient infrastructure failures are not your fault
and not a reason to stop.** I recorded the answers I *would* have recommended
as explicit defaults in the plan, got them approved, and kept moving. Don't
block on a flaky tool when a sensible, clearly-documented default exists.

---

## Phase 1 — Initialization (writing CLAUDE.md)

### What I'm about to do and why
`CLAUDE.md` is the first thing a future agent reads. Its value is *density of
non-obvious truth per line.* A future me can run `ls` and read `package.json`
on its own — so restating the directory tree is wasted space. What it cannot
cheaply discover is the stuff that took reading five files and a debugging
session to learn: which of three Supabase clients is safe where, that
`is_overnight` isn't a real column, that modals must portal to `document.body`.
Those are the lines that earn their place.

### How to do this efficiently
I did **not** re-explore. Phase 0 already told me the shape; here I did two
targeted things:
1. Read the top ~200 lines of `README.md` — the product's own spec, which
   captures the workspace model and the hard-won gotchas better than I could
   reconstruct. Reuse the author's knowledge; don't paraphrase from scratch.
2. Read only the *heads* (`head -50`) of the seven files that define the
   security boundary and scoping: the three `supabase/*.ts` clients, the
   middleware, `api-auth.ts`, `org-scope.ts`, `workspace.ts`. The doc-comments
   at the top of these files are unusually good — the authors already wrote the
   "why," so my job was to *distill and cross-link*, not invent.

**Teaching point:** heads-first reading. The top of a well-kept file (imports +
doc comment + signature) tells you 80% of what a summary needs. Read the whole
file only when you must trace behavior. For an orientation doc, heads are
plenty and cost a fraction of the tokens.

### What belongs vs what I deliberately left out
- **In:** the three-client boundary (the single most dangerous thing to get
  wrong), the workspace/`auth_org()` isolation model, where business logic
  lives (`src/lib/` by domain, not in components), the API-key + cron auth
  surfaces, and four domain gotchas that each previously caused a bug.
- **Out:** the exhaustive per-phase feature list from the README (discoverable,
  and it would bloat the file), the 204 KB `HANDOVER.md` contents (referenced by
  pointer with "skim by search, don't read whole" — a 204 KB inline paste would
  poison every future context window), and generic advice ("write tests,"
  "handle errors") which the init spec explicitly forbids and which teaches
  nothing.

### Mistakes / dead ends
None material here. The one judgment call: I nearly listed all 24 migration
filenames, then cut it — the *fact that RPCs and RLS live in migrations* is the
insight; the filenames are `ls`-able. Enumerating them would have been the
exact "easily discoverable" noise the init guidance warns against.

---

## Phase 2 — Testing & debug flow

### What I'm about to do and why
"Run the tests" is impossible here — there are none. So the honest version of a
testing phase is: **run the project's own definition of correct, in the cheapest
order, and treat each failure as a debugging task.** For this repo that
definition is the CI contract: typecheck → lint → build.

### How to do this efficiently — ordering is a strategy, not a formality
I ran them in a specific order for a reason, and this is the teaching point:
1. **`typecheck` first.** It is the fastest of the three and its errors are the
   cleanest (a type error points at one line with one cause). If the types are
   broken, the build will break too — so failing fast here saves the ~40s build.
2. **`lint` second.** Also fast; catches a different class (unused vars, hook
   rules, `<img>` usage) that typecheck ignores.
3. **`build` last.** Slowest and most integrative; only worth paying for once
   the cheap checks are green. A green build is the strongest single signal.

The general rule to internalize: **order your checks fast-and-narrow → slow-and-
integrative.** You want the check most likely to fail, and cheapest to run, to
run first. Never start with the 40-second build when a 5-second typecheck would
have caught the same class of error.

### What I found
- **typecheck: clean (exit 0).** `strict: true`, so this is real signal.
- **lint: clean (exit 0)** with 2 warnings — `<img>` instead of `next/image` in
  `GeneralSettingsTab.tsx:175` and `OrgLogo.tsx:24`. Warnings, not errors;
  logged as a low-severity finding, not a fix (judgment call the owner may have
  made deliberately for logo/avatar images).
- **build: clean (exit 0).** All 20+ routes compile; API routes and middleware
  build. The tree is healthy.
- **`npm ci` surfaced 5 advisories (4 high, 1 moderate)** — all in the toolchain
  dependency graph (`next` itself has a long list of DoS/SSRF/XSS advisories at
  this pinned version; `glob` via `eslint-config-next`; `postcss`). The fix is a
  major-version bump (`next@16`) — a breaking change, so it's a finding with a
  recommendation, not something I silently `audit fix --force`. Captured for the
  security report.

### The QA scripts — knowing when NOT to run something
`scripts/qa-prod-api-webhook.mjs` and `scripts/live-db-audit.mjs` are the repo's
real QA. I did **not** run them, and deciding that was the actual work:
- Both `loadEnv()` from `.env.local`, which **does not exist** in this
  environment (only `.env.local.example`). No secrets → they'd exit immediately.
- More importantly, `qa:prod` **POSTs to the live production API** and to
  webhook.site, and `live-db-audit` **attempts anon-client `insert`s against the
  live database** (they're negative RLS probes — "this insert SHOULD be blocked"
  — but they are still writes aimed at production).
- My standing rule is: no writes to production, ever, without an explicit ask.
  Even a "should be blocked" probe touches prod. So the right move is to read
  them, document exactly what they verify (API-key auth on `/api/v1/*`, webhook
  signature + retry seam, and that RLS blocks anon writes on sensitive tables),
  and leave running them to someone with the credentials and intent.

**Teaching point:** a script existing is not permission to run it. Read what it
*does* to the world before you execute it. "It has `prod` and `POST` in it" is a
stop sign until you know better.

### Mistakes / dead ends
None — the checks were green on the first pass, which is itself a finding: this
repo is disciplined about keeping `main`/branches CI-clean. The debugging
muscle didn't get exercised because there was nothing broken to debug.

---

## Phase 3 — Multi-agent code audit + my verification

### What I'm about to do and why
338 files is too much to read linearly, and reading everything myself would burn
the whole budget on files that turn out fine. The efficient shape is
**fan-out then verify**: spin up several cheaper workers (Sonnet) in parallel,
each with a *narrow* domain and a strict output contract, then spend my own
(more expensive) reasoning only on verifying what they flag. Breadth is
delegated; judgment is retained.

### How I briefed the delegates (and why it matters)
Five agents, one per domain (API routes, domain logic, data layer/migrations,
UI/state, integrations). The prompt design is the lever — a vague "review this"
gets vague slop back. Each brief had four non-negotiables:
1. **A tight scope** — exact file globs, so two agents don't audit the same
   file and I don't pay twice for the same coverage.
2. **A structured output contract** — JSON findings with `severity`, `file`,
   `line`, `failure_scenario`, `confidence`. Structure forces specificity: it's
   hard to write a fake `failure_scenario` with concrete inputs.
3. **The known gotchas seeded in** — I handed each agent the domain traps from
   CLAUDE.md (overnight wrap, rate snapshot, portal pattern). A worker that
   knows where the bodies are buried digs in the right place.
4. **A mandatory REASONING LOG** — "tell me how you searched and, crucially,
   what you traced and *ruled out*." The ruled-out list is how I judge whether
   an agent actually understood the code or just pattern-matched. An agent that
   says "I suspected X but migration Y hardened it" has earned trust; one with
   no ruled-outs probably didn't look hard.

**Teaching point for the junior model:** why Sonnet and not the top model for
this? Because *finding candidates* is recall-bound, not depth-bound — you want
many eyes reading breadth-first, and Sonnet reads code well. The expensive
depth-reasoning is reserved for the *verification* step, which is where being
wrong is costly. Match the model tier to the cost-of-being-wrong at each stage.

### How I verified — refute-first, on the code, myself
This is the part you must never skip. For every High/Critical finding I opened
the cited file and tried to *break the claim* before believing it:

- **`isOvernightShift` `<=` bug** (`time/validation.ts:41`): I read the function
  and hand-traced `durationHours("09:00","09:00")` through `hoursBetween` — the
  `<=` makes equal times "overnight," `endMin += 1440`, result 24h. **CONFIRMED.**
- **Timer "Stop and start new"** (`TimerContext.tsx` + `FloatingTimer.tsx:434`):
  the agent claimed a critical dead-flow. I didn't take it on faith — I read the
  actual button handler and saw `stopTimer()` (which sets
  `pendingStart.current = false`) is called *before* `confirmStopAndStart()`
  (which only starts if that flag is true). The order guarantees the no-op.
  **CONFIRMED.**
- **Reports use the forbidden generated column** (`reports/queries.ts:110,128`):
  I read it and confirmed it selects raw `total_hours` and does `if (h<=0)
  continue` — silently dropping overnight (negative) and 24h-decimal (zero)
  rows, exactly the trap CLAUDE.md warns about. **CONFIRMED.**
- **Personal-user document block** (`documents/authorization.ts:34`): the logic
  bug is real (personal admin has `org_id=null` → `!actor.org_id` → Forbidden).
  But the agent claimed the UI button is shown "unconditionally." I checked
  `TimesheetListTable.tsx:304` and `:54` — the button renders for any approved
  timesheet with a non-null `calculated_total`, and line 54's org gate is on
  *delete*, not the document button. So the button IS ungated by role — but
  reachability still hinges on whether a personal timesheet ever gets
  `calculated_total` set. I could not confirm that, so I **downgraded this to
  PLAUSIBLE** rather than parrot the agent's "high/confirmed." *This is the
  discipline: an agent's confidence is an input, not a verdict.*
- **Leave half-day** (`leave/days.ts:19`): function clearly returns flat `0.5`
  for any range. The agent said the modal allows multi-day + half-day; my first
  grep of `src/components/app` found nothing and I nearly dropped it as
  unreachable — then I widened the search and found the modal lives in
  `src/app/app/leave/RequestLeaveModal.tsx`, where the Half-day checkbox stays
  active alongside separate start/end date inputs. **CONFIRMED reachable.**
  (Dead end worth recording: I searched the wrong directory first and almost
  discarded a real bug — always widen before you conclude "not reachable.")

### What I rejected outright
- **Admin-client leaking to the browser**: I grepped every `"use client"` file
  for an admin import (zero), and the `import "server-only"` guard means the
  build itself would fail otherwise — and the build passed. **REFUTED / safe.**
- **OAuth open-redirect** and **`expenses_update` missing WITH CHECK**: agents
  correctly ruled these out themselves (redirects built from env/origin not
  query params; Postgres defaults `WITH CHECK` to `USING`), and I agreed on
  reading. Not reported.

---

## Phase 4 — Security check + prior-audit regression

### What I'm about to do and why
Security is where delegation is *most* useful (breadth) and *least* trustworthy
(a missed auth check is catastrophic, a false alarm wastes everyone's time). So
I split it: I personally own the "crown jewels" (the surfaces where a single
mistake = full breach), delegate the breadth sweeps, run the platform's own
live advisors, and — cheapest high-yield move of all — regression-check the
*previous* audit.

### The crown jewels I audited myself (before any delegation)
Rule: **do not delegate the thing that ends the company if it's wrong.** I
hand-checked, with grep-then-read:
- **Service-role key boundary.** Grepped every `"use client"` file for an admin
  import (none), and the `import "server-only"` guard makes a leak a build
  failure — build passed. Safe.
- **The `api/v1` auth chain**, **cron `CRON_SECRET`**, **webhook signing**, and
  **crypto** — read each end to end.

Two things fell out of my own reading, before agents reported anything:
1. **SSRF in webhook dispatch** — `isValidUrl` allows `http://` to *any* host
   (no block on `localhost`/private ranges/`169.254.169.254`) and the dispatcher
   reflects 500 bytes of the response into a store the org admin can read. I
   found this by reading `webhook-dispatcher.ts` → tracing `endpoint.url` back to
   its validation at creation. The integrations agent independently found the
   same thing — *independent corroboration raises confidence more than one loud
   claim.*
2. **Cron secret uses `!==`** (not constant-time) and the **rate limiter is
   in-memory** (per-instance on serverless) — both minor, both real.

### The single most important verification of the whole pass
The RLS agent reported a **critical**: `api_keys` INSERT policy checks only
`user_id = auth.uid()`, not `org_id`. A claim like that is either the finding
of the audit or an embarrassing false alarm — so I refused to write it down
until I'd read every link myself:
1. Read the exact policy SQL: `for insert with check (user_id = auth.uid())` —
   confirmed, no `org_id` check.
2. Asked the obvious refutation: "isn't direct table insert blocked?" Checked
   the L1 hardening loop — it revokes insert/update/delete **from `anon` only**.
   An attacker uses their *authenticated* session (role `authenticated`), which
   still holds INSERT. Refutation failed → finding survives.
3. Checked for a compensating control: does `validateApiKey` re-verify
   membership? Read `api-auth.ts` — no, it trusts the row's `org_id`. Is
   `hashApiKey` attacker-reproducible? Read `crypto.ts` — unsalted SHA-256, yes.
   Do the v1 routes scope by that `org_id`? Read all three — yes.

Every refutation I could think of failed, so the chain is real: an authenticated
user forges a `full` key bound to a victim org and reads/writes its data.
**CONFIRMED CRITICAL.**

**Teaching point — the ethics of verifying a live vuln.** I could have *proven*
it by inserting the row against the production database. I did not, and you must
not: verifying a vulnerability must never itself be the exploit. Reading the
SQL and the code is conclusive; writing attacker rows to a real tenant's
database is not "testing," it's the attack. Confirm by inspection; recommend the
owner confirm by a controlled test in a scratch org.

### Cheap, high-yield: regression-checking the old audit
`SECURITY_AUDIT.md` lists prior findings (C1, C2/H1, M1, M2, L1, L2, W1, F4). A
delegate mapped each to its fix and re-read the code. **All still fixed** — a
genuinely reassuring result, and it cost one agent. The same agent caught a
*latent recurrence*: `getOrgReport` (added after L2 closed) trusts a caller
`orgId` without `trustOrgScope` — not exploitable today (call sites pass
server-derived ids) but the exact pattern L2 was meant to kill. Lesson: **a
closed finding is a pattern to keep enforcing, not a box to tick once.**

### Live database, read-only
The Supabase MCP was connected, so I ran the built-in **security and
performance advisors** against the real project (read-only — no writes, no
migrations). They corroborated the code findings from a different angle: 2
functions with mutable `search_path`, a public `org-logos` bucket allowing
listing, `SECURITY DEFINER` helpers callable by `anon` via RPC, and 65
`auth_rls_initplan` per-row re-evaluations + 36 unindexed tenant FK columns
(the `org_id` scoping columns) — mechanical, high-value perf fixes.

### Dead ends / calibration
The RLS deep-dive otherwise came back clean (RLS enabled on every tenant table,
no `USING (true)`, profile self-escalation genuinely blocked, storage buckets
scoped) — I record that explicitly, because **"I checked X and it was fine" is a
finding too.** An audit that only lists problems hides how much ground was
actually covered.

---

## Phase 5 — Closing: the patterns worth stealing

If you remember nothing else from this log, remember these. They are ordered by
how much time they save you.

1. **Read the repo's definition of "correct" before its code.** `package.json`
   scripts + CI workflow + tsconfig told me the contract (`typecheck → lint →
   build`) in 30 seconds. Reproducing that contract locally was the cheapest
   possible confidence check. You cannot audit a thing until you know how it
   judges itself.

2. **Fan-out for breadth, keep judgment for yourself.** Cheap parallel workers
   read 338 files; my expensive reasoning went only into verifying what they
   flagged. Match the model tier to the cost-of-being-wrong at each stage:
   recall-bound discovery can be delegated; a wrong critical cannot.

3. **A finding is a hypothesis until you've tried to refute it.** The one
   critical (forgeable API keys) survived *because* I attacked it — "isn't the
   insert blocked?" led me to the grant loop, which turned out to revoke `anon`
   but not `authenticated`. Had that refutation succeeded, I'd have dropped the
   finding. Every High got the same treatment; two agent claims got downgraded
   to PLAUSIBLE when I couldn't close the loop, and several were dropped.

4. **Search narrows, reading confirms — in that order.** Grep for the dangerous
   token (`service_role`, `USING (true)`, `<=` in time math, `dangerouslySet…`),
   get a short candidate list, then read those lines closely. Reading first is
   how you run out of budget at file 40 of 338.

5. **Independent corroboration beats a loud single voice.** I found the SSRF by
   reading the dispatcher; the integrations agent found it separately from the
   creation path. Two paths to the same conclusion is worth more than one
   confident assertion.

6. **Regression-check the last audit — it's the cheapest high-yield move there
   is.** One agent re-verified eight prior findings (all still fixed) and caught
   a latent recurrence of one pattern in newer code. A closed finding is a
   pattern to keep enforcing, not a box ticked once.

7. **Record what you checked and found *fine*, not just the problems.** "RLS is
   enabled on every tenant table; no `USING (true)`; profile self-escalation is
   blocked" is a result. An audit that lists only defects hides its own
   coverage and can't be trusted to have looked where it says it did.

8. **Verifying a vulnerability must never be the exploit.** The critical was
   confirmed by reading SQL + code, not by inserting an attacker row into the
   production database. Confirm by inspection; recommend the owner confirm by a
   controlled test in a throwaway environment.

9. **Know when *not* to run a script.** The QA scripts existed and were one
   command away — but they touch production and need secrets I didn't have.
   "It's runnable" is not "I should run it." Read what a command does to the
   world first.

### Where the bodies clustered
Notably, three of the confirmed High bugs (24h phantom shift, reports dropping
overnight hours, `hours=24` zeroing) all live in **time/duration math** — the
exact domain `CLAUDE.md` flags as the historical trap, and the exact domain with
**zero tests**. That correlation is the real headline for the maintainer: the
most fragile, most business-critical logic (it multiplies into payroll) is the
least protected. The single highest-leverage follow-up isn't any one fix — it's
putting `src/lib/time/*` under test so the next regression is caught by CI
instead of an audit.





