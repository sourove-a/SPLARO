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

# ── Git sync ─────────────────────────────────────────────────
# Hard-reset to origin so stray edits on the VPS can never block a deploy.
# The VPS working tree is a deploy target, not a dev checkout.
log "Syncing to origin/$BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

# ── pnpm ─────────────────────────────────────────────────────
export PNPM_HOME="${PNPM_HOME:-/root/.local/share/pnpm}"
export PATH="$PNPM_HOME:/root/.local/bin:$PATH"
[ -f infrastructure/hostinger/ensure-pnpm.sh ] && bash infrastructure/hostinger/ensure-pnpm.sh
command -v pnpm >/dev/null || die "pnpm not found"

log "pnpm install..."
NODE_ENV=development pnpm install --frozen-lockfile --prod=false

log "Prisma..."
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push:prod

log "Bootstrap store contact from .env (idempotent)…"
pnpm db:bootstrap-store 2>&1 | tail -8 || log "WARN: store bootstrap skipped"

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

# ── Meilisearch + Nginx performance (idempotent, safe reload) ─
if [ -f infrastructure/vps/setup-meilisearch.sh ]; then
  bash infrastructure/vps/setup-meilisearch.sh || log "WARN: Meilisearch setup skipped"
fi
if [ -f infrastructure/vps/setup-nginx-performance.sh ]; then
  bash infrastructure/vps/setup-nginx-performance.sh || log "WARN: nginx performance skipped"
fi

# ── Nginx ────────────────────────────────────────────────────
if nginx -t 2>/dev/null; then
  systemctl reload nginx
fi

maybe_purge_demo_catalog() {
  if [ "${SPLARO_PURGE_DEMO_ON_DEPLOY:-0}" != "1" ]; then
    log "Demo purge skipped (SPLARO_PURGE_DEMO_ON_DEPLOY≠1 — real catalog safe on deploy)"
    return 0
  fi

  local store="${NEXT_PUBLIC_STORE_ID:-splaro}"

  if [ -n "${INTERNAL_HEALTH_SECRET:-}" ]; then
    local body_file
    body_file="$(mktemp)"
    local code
    code="$(curl -s -m 120 -o "$body_file" -w '%{http_code}' -X POST \
      "http://127.0.0.1:4000/api/v1/storefront/deploy/purge-demo?storeId=${store}" \
      -H "x-splaro-internal: ${INTERNAL_HEALTH_SECRET}" \
      -H "Content-Type: application/json" || echo 000)"
    local body
    body="$(tr -d '\n' < "$body_file" | head -c 400)"
    rm -f "$body_file"
    if [ "$code" = "200" ] || [ "$code" = "201" ]; then
      log "Demo purge (API): HTTP $code — $body"
      return 0
    fi
    log "WARN: demo purge API failed (HTTP $code) — $body — falling back to script"
  else
    log "WARN: INTERNAL_HEALTH_SECRET unset — demo purge via script only (no cache bust)"
  fi

  pnpm db:purge-demo 2>&1 | tail -12 || log "WARN: demo purge script failed"
}

maybe_reindex_search() {
  if [ -z "${INTERNAL_HEALTH_SECRET:-}" ] || [ -z "${MEILISEARCH_HOST:-}" ]; then
    return 0
  fi
  if ! curl -sf -m 5 "${MEILISEARCH_HOST}/health" >/dev/null 2>&1; then
    log "Meilisearch not healthy — skipping search reindex"
    return 0
  fi
  local store="${NEXT_PUBLIC_STORE_ID:-splaro}"
  local res
  res="$(curl -sf -m 120 -X POST \
    "http://127.0.0.1:4000/api/v1/search/deploy/reindex?storeId=${store}" \
    -H "x-splaro-internal: ${INTERNAL_HEALTH_SECRET}" \
    -H "Content-Type: application/json" 2>&1)" || {
    log "WARN: search reindex skipped ($res)"
    return 0
  }
  log "Search reindex: $res"
}

wait_for_local_health() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local delay="${4:-3}"
  local code="000"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then
      log "$label healthy (HTTP $code) after ${i} attempt(s)"
      return 0
    fi
    log "Waiting for $label… HTTP $code (attempt $i/$attempts)"
    sleep "$delay"
    i=$((i + 1))
  done
  log "$label not ready after $attempts attempts (last HTTP $code)"
  return 1
}

sleep 6

if pnpm db:enable-telegram 2>/dev/null; then
  log "Telegram — all notification flags enabled"
  pm2 restart splaro-api --update-env 2>/dev/null || true
else
  log "WARN: telegram enable skipped (no config yet)"
fi

# API restarts after telegram enable — cluster mode needs time to bind :4000
wait_for_local_health "http://127.0.0.1:3000/" "web" 20 2 || true
wait_for_local_health "http://127.0.0.1:4000/api/v1/health" "api" 40 3 || die "Health check failed — pm2 logs splaro-api"

maybe_purge_demo_catalog
maybe_reindex_search

WEB="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/ 2>/dev/null || echo 000)"
API="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4000/api/v1/health 2>/dev/null || echo 000)"

log "Health — web:$WEB api:$API"
log "========== VPS DEPLOY COMPLETE =========="
log "Tip: install watchdog cron — see infrastructure/vps/splaro-watchdog.sh"

[ "$WEB" = "200" ] && [ "$API" = "200" ] || die "Health check failed — pm2 logs"
