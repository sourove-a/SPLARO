#!/bin/bash
# SPLARO VPS — redeploy (git pull → build → PM2 reload)
# Used by GitHub Actions auto-deploy and manual updates.
#
# Usage (on VPS):
#   bash /var/www/splaro/infrastructure/vps/deploy.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
LOG_FILE="/var/log/splaro/deploy.log"
BRANCH="${SPLARO_BRANCH:-main}"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

log() { echo "[$TIMESTAMP] $*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

log "========== VPS DEPLOY START =========="

cd "$APP_DIR" || die "Missing $APP_DIR"

# Load env
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi

export SPLARO_APP_DIR="$APP_DIR"
export SPLARO_LOG_DIR="${SPLARO_LOG_DIR:-/var/log/splaro}"
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=6144"

# ── Git pull ─────────────────────────────────────────────────
log "Pulling origin/$BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

# ── pnpm ─────────────────────────────────────────────────────
export PNPM_HOME="${PNPM_HOME:-/root/.local/share/pnpm}"
export PATH="$PNPM_HOME:/root/.local/bin:$PATH"
[ -f infrastructure/hostinger/ensure-pnpm.sh ] && bash infrastructure/hostinger/ensure-pnpm.sh
command -v pnpm >/dev/null || die "pnpm not found"

log "pnpm install..."
pnpm install --frozen-lockfile

log "Prisma..."
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push

log "Build..."
pnpm build:all
node scripts/prepare-next-standalone.mjs apps/web
node scripts/prepare-next-standalone.mjs apps/admin

# ── PM2 ──────────────────────────────────────────────────────
PM2_CONFIG="infrastructure/pm2/ecosystem.config.js"
[ -f "$PM2_CONFIG" ] || PM2_CONFIG="infrastructure/pm2/ecosystem.hostinger.config.js"

log "PM2 reload..."
pm2 startOrReload "$PM2_CONFIG" --update-env
pm2 save

# ── Nginx ────────────────────────────────────────────────────
if nginx -t 2>/dev/null; then
  systemctl reload nginx
fi

sleep 6
WEB="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)"
API="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health || echo 000)"

log "Health — web:$WEB api:$API"
log "========== VPS DEPLOY COMPLETE =========="

[ "$WEB" = "200" ] && [ "$API" = "200" ] || die "Health check failed — pm2 logs"
