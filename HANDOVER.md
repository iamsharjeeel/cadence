# Handover

## 2026-07-06 — Local ↔ cloud sync

- **What changed:** Added `scripts/sync-from-cloud.sh` and `scripts/sync-to-cloud.sh`; README section documents the always-sync workflow.
- **Why:** Desktop clone and cloud agent workspace must stay on the same GitHub commit.
- **Files touched:** `README.md`, `scripts/sync-from-cloud.sh`, `scripts/sync-to-cloud.sh`, `CHANGELOG.md`, `HANDOVER.md`
- **Pending:** Run `./scripts/sync-from-cloud.sh` on your Mac once to overwrite `~/Desktop/cadence` with latest `main`.
