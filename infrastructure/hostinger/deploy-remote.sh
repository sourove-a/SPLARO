#!/bin/bash
# SPLARO — Hostinger remote deploy (run ON the server via SSH or hPanel terminal)
# Full stack: web :3000 + admin :3001 + API :4000
#
# Usage:
#   export SPLARO_APP_DIR=$HOME/splaro
#   bash infrastructure/hostinger/deploy-remote.sh

set -euo pipefail

DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
APP_DIR="${SPLARO_APP_DIR:-$HOME/splaro}"
REPO_URL="${SPLARO_REPO:-https://github.com/sourove-a/SPLARO.git}"
BRANCH="${SPLARO_BRANCH:-main}"
PM2_CONFIG="${SPLARO_PM2_CONFIG:-infrastructure/pm2/ecosystem.hostinger.config.js}"
LOG_DIR="${SPLARO_LOG_DIR:-$APP_DIR/logs}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

log "SPLARO deploy — domain=$DOMAIN app=$APP_DIR user=$(whoami)"

require_cmd git
require_cmd node

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node 20+ required (found $(node -v))"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"
require_cmd pnpm
log "Using pnpm $(pnpm --version)"

mkdir -p "$APP_DIR" "$LOG_DIR"
cd "$APP_DIR"

if [ ! -d .git ]; then
  log "Cloning repository..."
  git clone "$REPO_URL" .
else
  log "Pulling latest..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  log "Created .env from .env.example — set DATABASE_URL and secrets before traffic."
fi

if [ ! -f .env ]; then
  die ".env missing. Run: bash infrastructure/hostinger/generate-production-env.sh > $APP_DIR/.env"
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

export SPLARO_APP_DIR="$APP_DIR"
export SPLARO_LOG_DIR="$LOG_DIR"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.splaro.co/api/v1}"
export WEB_URL="${WEB_URL:-https://splaro.co}"
export ADMIN_URL="${ADMIN_URL:-https://admin.splaro.co}"
export API_URL="${API_URL:-https://api.splaro.co}"
export CORS_ORIGINS="${CORS_ORIGINS:-https://splaro.co,https://admin.splaro.co}"
export PAYMENT_DEV_STUB="${PAYMENT_DEV_STUB:-false}"

if [ -z "${DATABASE_URL:-}" ]; then
  die "DATABASE_URL is required. Use Neon/Supabase on shared hosting: postgresql://user:pass@host/db?sslmode=require"
fi

if [[ "${DATABASE_URL}" == *"neon.tech"* ]] || [[ "${DATABASE_URL}" == *"supabase.co"* ]]; then
  log "Remote PostgreSQL detected"
elif ! command -v psql >/dev/null 2>&1; then
  log "No local psql — ensure DATABASE_URL points to a reachable Postgres host"
fi

if [ "${REDIS_ENABLED:-true}" = "true" ] && ! command -v redis-cli >/dev/null 2>&1; then
  log "WARNING: redis-cli not found — set REDIS_ENABLED=false or REDIS_URL to Upstash"
fi

log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Prisma generate + migrate..."
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push

log "Seed database (idempotent)..."
pnpm db:seed || log "Seed skipped — check logs if first deploy"

log "Building apps (web + admin + api)..."
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
pnpm build:all

log "Preparing Next.js standalone bundles..."
node scripts/prepare-next-standalone.mjs apps/web
node scripts/prepare-next-standalone.mjs apps/admin

for artifact in \
  "apps/web/.next/standalone/apps/web/server.js" \
  "apps/admin/.next/standalone/apps/admin/server.js" \
  "apps/api/dist/main.js"
do
  [ -f "$APP_DIR/$artifact" ] || die "Build artifact missing: $artifact"
done
log "Build artifacts OK"

if ! command -v pm2 >/dev/null 2>&1; then
  log "Installing PM2..."
  npm install -g pm2
fi

log "PM2 reload ($PM2_CONFIG)..."
pm2 startOrReload "$PM2_CONFIG" --update-env
pm2 save

if command -v nginx >/dev/null 2>&1 && [ -w /etc/nginx/sites-available ] 2>/dev/null; then
  log "Installing nginx vhosts for $DOMAIN..."
  cp infrastructure/hostinger/splaro-co-web.conf /etc/nginx/sites-available/splaro-co-web.conf
  cp infrastructure/hostinger/splaro-co-admin.conf /etc/nginx/sites-available/splaro-co-admin.conf
  cp infrastructure/hostinger/splaro-co-api.conf /etc/nginx/sites-available/splaro-co-api.conf
  ln -sf /etc/nginx/sites-available/splaro-co-web.conf /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/splaro-co-admin.conf /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/splaro-co-api.conf /etc/nginx/sites-enabled/
  nginx -t
  systemctl reload nginx
else
  log "nginx skip — configure splaro.co → :3000, admin.splaro.co → :3001, api.splaro.co → :4000 in hPanel"
fi

sleep 6
WEB_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)"
ADMIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ || echo 000)"
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health || echo 000)"

log "Local health — web:$WEB_CODE admin:$ADMIN_CODE api:$API_CODE"
pm2 status || true

if [ "$WEB_CODE" = "200" ] && [ "$ADMIN_CODE" = "200" ] && [ "$API_CODE" = "200" ]; then
  log "Deploy OK — https://$DOMAIN"
  exit 0
fi

[ "$WEB_CODE" != "200" ] && log "FAIL: web (:3000) returned $WEB_CODE — pm2 logs splaro-web"
[ "$ADMIN_CODE" != "200" ] && log "FAIL: admin (:3001) returned $ADMIN_CODE — pm2 logs splaro-admin"
[ "$API_CODE" != "200" ] && log "FAIL: api (:4000) returned $API_CODE — pm2 logs splaro-api"
die "Deploy health check failed — services above are not responding"
