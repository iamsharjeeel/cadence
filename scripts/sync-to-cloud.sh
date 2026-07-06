#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-${CADENCE_LOCAL_PATH:-$HOME/Desktop/cadence}}"
REMOTE="${CADENCE_REMOTE:-origin}"
MESSAGE="${2:-chore: sync local changes to cloud}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "No git repo at $REPO_DIR. Run scripts/sync-from-cloud.sh first." >&2
  exit 1
fi

cd "$REPO_DIR"

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "Detached HEAD — checkout a branch before pushing." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MESSAGE"
fi

git push -u "$REMOTE" "$BRANCH"

SHA="$(git rev-parse --short HEAD)"
echo "Pushed $BRANCH ($SHA) to $REMOTE — cloud agents and Vercel use this branch."
