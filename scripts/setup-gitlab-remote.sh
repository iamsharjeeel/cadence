#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-${CADENCE_LOCAL_PATH:-$HOME/Desktop/cadence}}"
URL="${CADENCE_GITLAB_URL:-}"

if [[ -z "$URL" ]]; then
  echo "Set CADENCE_GITLAB_URL to your GitLab clone URL, e.g.:" >&2
  echo "  export CADENCE_GITLAB_URL=https://gitlab.com/<namespace>/s1mplesolutions.cc-project.git" >&2
  exit 1
fi

cd "$REPO_DIR"

if git remote get-url gitlab &>/dev/null; then
  git remote set-url gitlab "$URL"
  echo "Updated gitlab remote → $URL"
else
  git remote add gitlab "$URL"
  echo "Added gitlab remote → $URL"
fi

git remote -v
