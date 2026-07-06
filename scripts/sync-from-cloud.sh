#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-${CADENCE_LOCAL_PATH:-$HOME/Desktop/cadence}}"
REMOTE="${CADENCE_REMOTE:-origin}"
BRANCH="${CADENCE_BRANCH:-main}"
REPO_URL="${CADENCE_REPO_URL:-git@github.com:iamsharjeeel/cadence.git}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "No git repo at $REPO_DIR — cloning $REPO_URL"
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
else
  cd "$REPO_DIR"
  git fetch "$REMOTE"
  git checkout "$BRANCH"
  git reset --hard "$REMOTE/$BRANCH"
  git clean -fd
fi

npm install

SHA="$(git rev-parse --short HEAD)"
echo "Local copy synced to $REMOTE/$BRANCH ($SHA)"
