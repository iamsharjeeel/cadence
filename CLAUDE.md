# Claude Repository Instructions

Read and follow `AGENTS.md` before making any change. Its security, verification, Git workflow, and attribution rules are mandatory.

## Canonical authorship

Use only the repository-owner identity for repository-controlled attribution:

- `Sharjeel`
- `@iamsharjeeel`
- `iamsharjeeel+github@gmail.com`

Before every commit:

```bash
git config --local user.name "Sharjeel"
git config --local user.email "iamsharjeeel+github@gmail.com"
```

Never commit as Claude or another agent/tool. Never add agent `Co-authored-by:` trailers or generated-by credits. Use Sharjeel for editable author, publisher, maintainer, creator, and equivalent metadata. Platform-controlled GitHub actors must not be spoofed.

Verify the latest commit identity before pushing:

```bash
git log -1 --format='%an <%ae> | %cn <%ce>'
```
