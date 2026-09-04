# Cadence — Repository Agent Instructions

These instructions are mandatory for every coding or automation agent working in this repository. Read `README.md`, `HANDOVER.md`, and the task-relevant source/configuration before changing behavior.

## Canonical authorship and attribution

All repository-controlled authorship, ownership, publisher, maintainer, creator, and generated attribution belongs to the repository owner:

- Name: `Sharjeel`
- GitHub: `@iamsharjeeel`
- Email: `iamsharjeeel+github@gmail.com`

Before every commit, hardcode the local Git identity:

```bash
git config --local user.name "Sharjeel"
git config --local user.email "iamsharjeeel+github@gmail.com"
```

Never use an AI agent, model, bot, vendor, or automation identity as author, committer, co-author, publisher, maintainer, creator, or generated-by credit. This includes Cursor, Cursor Agent, Claude, Codex, ChatGPT, Manus, Copilot, Gemini, Antigravity, and similar tools. Never add agent `Co-authored-by:` trailers.

Where editable repository/package/document metadata has `author`, `authors`, `maintainer`, `publisher`, `creator`, or equivalent ownership fields, use Sharjeel's identity above. GitHub-controlled actor identity for web merges, reviews, and comments cannot be overridden; never spoof it.

Before push, verify:

```bash
git log -1 --format='%an <%ae> | %cn <%ce>'
```

Normal agent-created commits must resolve to `Sharjeel <iamsharjeeel+github@gmail.com>` for both author and committer.

## Working rules

- Keep changes scoped and reviewable.
- Never commit secrets or credentials.
- Preserve tenant isolation, authorization, RLS, migrations, and production data safety.
- Run the relevant lint, typecheck, tests, build, and production verification before claiming completion.
- Keep repository documentation current when architecture or operational behavior changes.
- Do not rewrite history or force-push unless Sharjeel explicitly requests it.
