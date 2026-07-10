#!/bin/bash
# SPLARO VPS — thin entrypoint installed at /opt/splaro/deploy.sh.
# GitHub Actions always calls THIS file. It never goes stale because it just
# delegates to the repo's own infrastructure/vps/deploy.sh — which self-heals
# a missing/rebuilt checkout (see deploy.sh's fresh-clone fallback). This
# wrapper only needs to handle the case where APP_DIR doesn't exist at all yet.

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
REPO_SSH="${SPLARO_REPO_SSH:-git@github.com:sourove-a/SPLARO.git}"
DEPLOY_KEY="${SPLARO_DEPLOY_KEY:-/root/.ssh/github_deploy}"
BRANCH="${SPLARO_BRANCH:-main}"

if [ ! -d "$APP_DIR" ] || [ -z "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  echo "[wrapper] $APP_DIR missing or empty — bootstrap cloning before delegating."
  mkdir -p "$APP_DIR"
  [ -f "$DEPLOY_KEY" ] || { echo "[wrapper] ERROR: missing deploy key $DEPLOY_KEY"; exit 1; }
  GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    git clone --branch "$BRANCH" "$REPO_SSH" "$APP_DIR"
fi

exec bash "$APP_DIR/infrastructure/vps/deploy.sh" "$@"
