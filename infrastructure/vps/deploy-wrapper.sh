#!/bin/bash
# SPLARO VPS — thin entrypoint installed at /opt/splaro/deploy.sh.
# GitHub Actions always calls THIS file. Resolve deploy.sh from the approved
# remote commit before executing it: calling the file from the current checkout
# makes deploy-script changes take effect one release late because Bash keeps
# running the already-open old script after that script resets/swaps APP_DIR.

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

[ -d "$APP_DIR/.git" ] || { echo "[wrapper] ERROR: missing git checkout at $APP_DIR"; exit 1; }
[ -f "$DEPLOY_KEY" ] || { echo "[wrapper] ERROR: missing deploy key $DEPLOY_KEY"; exit 1; }

cd "$APP_DIR"
GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git fetch origin "$BRANCH"

DEPLOY_REF="origin/$BRANCH"
if [ -n "${SPLARO_DEPLOY_SHA:-}" ]; then
  git cat-file -e "${SPLARO_DEPLOY_SHA}^{commit}" 2>/dev/null \
    || { echo "[wrapper] ERROR: approved commit not found: $SPLARO_DEPLOY_SHA"; exit 1; }
  git merge-base --is-ancestor "$SPLARO_DEPLOY_SHA" "origin/$BRANCH" \
    || { echo "[wrapper] ERROR: approved commit is not on origin/$BRANCH"; exit 1; }
  DEPLOY_REF="$SPLARO_DEPLOY_SHA"
fi

DEPLOY_SCRIPT="$(mktemp)"
trap 'rm -f "$DEPLOY_SCRIPT"' EXIT
git show "$DEPLOY_REF:infrastructure/vps/deploy.sh" >"$DEPLOY_SCRIPT" \
  || { echo "[wrapper] ERROR: deploy.sh missing from $DEPLOY_REF"; exit 1; }

bash "$DEPLOY_SCRIPT" "$@"
