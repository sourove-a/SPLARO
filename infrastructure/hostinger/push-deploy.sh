#!/bin/bash
# Push main → Hostinger Git auto-redeploy (hPanel connected repo)
#
# Usage:
#   pnpm deploy:hostinger
#   pnpm deploy:hostinger -- -m "fix: checkout"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"
DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
COMMIT_MSG=""

usage() {
  cat <<'EOF'
SPLARO Hostinger deploy (Git push)

  pnpm deploy:hostinger                 Push main — Hostinger auto-redeploys
  pnpm deploy:hostinger -- -m "msg"     Commit all + push + deploy

Requires: hPanel → Deployments → GitHub connected, auto-deploy on push.

hPanel build settings (once):
  Package manager: npm
  Framework:       Express
  Build command:   npm run build
  Start command:   npm start
  Output dir:      apps/web/.next/standalone/apps/web

See infrastructure/hostinger/HPANEL.md
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift; continue ;;
    -m|--message)
      COMMIT_MSG="${2:-}"
      [ -n "$COMMIT_MSG" ] || { echo "ERROR: -m needs a message" >&2; exit 1; }
      shift 2
      ;;
    -h|--help) usage 0 ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      usage 1
      ;;
  esac
done

CURRENT="$(git branch --show-current)"
if [ "$CURRENT" != "$BRANCH" ]; then
  echo "WARNING: on branch '$CURRENT', pushing origin/$BRANCH"
fi

if [ -n "$COMMIT_MSG" ]; then
  git add -A
  if git diff --cached --quiet; then
    echo "Nothing staged to commit"
  else
    git commit -m "$COMMIT_MSG"
    echo "Committed: $COMMIT_MSG"
  fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: uncommitted changes — commit first or use -m 'message'" >&2
  git status --short
  exit 1
fi

AHEAD="$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo 0)"
if [ "$AHEAD" = "0" ]; then
  echo "Already up to date with origin/$BRANCH — nothing to push"
  echo "hPanel → Deployments → Redeploy to rebuild without new commits"
  exit 0
fi

echo "═══ Pre-deploy checks (type-check, lint, CSS, production env) ═══"
node "$ROOT/scripts/pre-deploy.mjs"

SHA="$(git rev-parse --short HEAD)"
echo "Pushing $SHA → origin/$BRANCH ..."
SPLARO_SKIP_PRE_PUSH=1 git push origin "HEAD:${BRANCH}"

echo ""
echo "Deploy started — Hostinger pulls main automatically."
echo "  hPanel → Websites → ${DOMAIN} → Deployments"
echo "  Build log should show: [ensure-pnpm] OK — pnpm 9.4.0"
echo ""
echo "Live check (may take 3–8 min):"
sleep 3
curl -sI --max-time 20 "https://${DOMAIN}" | head -5 || echo "  (site not ready yet — check hPanel logs)"
