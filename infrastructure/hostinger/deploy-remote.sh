#!/bin/bash
# SPLARO — Hostinger remote deploy (run ON the server after SSH)
# Usage: bash infrastructure/hostinger/deploy-remote.sh

set -euo pipefail

DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
REPO_URL="${SPLARO_REPO:-https://github.com/sourove-a/SPLARO.git}"
BRANCH="${SPLARO_BRANCH:-main}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

log "SPLARO deploy — domain=$DOMAIN app=$APP_DIR"

require_cmd git
require_cmd node
require_cmd pnpm

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node 20+ required (found $(node -v))"
fi

if ! command -v psql >/dev/null 2>&1; then
  die "PostgreSQL client not found. SPLARO needs a VPS with Postgres+Redis (shared PHP hosting cannot run the full stack)."
fi

if ! command -v redis-cli >/dev/null 2>&1; then
  die "Redis not found. Install Redis or use a VPS."
fi

mkdir -p "$APP_DIR"
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
  log "Created .env from .env.example — edit secrets before production traffic."
fi

if [ ! -f .env ]; then
  die ".env missing. Copy .env.example and set DATABASE_URL, JWT_SECRET, domain URLs."
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.splaro.co/api/v1}"
export WEB_URL="${WEB_URL:-https://splaro.co}"
export ADMIN_URL="${ADMIN_URL:-https://admin.splaro.co}"
export API_URL="${API_URL:-https://api.splaro.co}"
export CORS_ORIGINS="${CORS_ORIGINS:-https://splaro.co,https://admin.splaro.co}"

log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Prisma generate + migrate..."
pnpm db:generate
pnpm db:migrate:prod

log "Building apps..."
pnpm build:all

log "PM2 reload..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
pm2 startOrReload infrastructure/pm2/ecosystem.config.js --update-env
pm2 save

if command -v nginx >/dev/null 2>&1 && [ -w /etc/nginx/sites-available ]; then
  log "Installing nginx vhosts for $DOMAIN..."
  cp infrastructure/hostinger/splaro-co-web.conf /etc/nginx/sites-available/splaro-co-web.conf
  cp infrastructure/hostinger/splaro-co-admin.conf /etc/nginx/sites-available/splaro-co-admin.conf
  cp infrastructure/hostinger/splaro-co-api.conf /etc/nginx/sites-available/splaro-co-api.conf
  ln -sf /etc/nginx/sites-available/splaro-co-web.conf /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/splaro-co-admin.conf /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/splaro-co-api.conf /etc/nginx/sites-enabled/
  nginx -t
  systemctl reload nginx
fi

sleep 5
WEB_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 || echo 000)"
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health || echo 000)"

log "Health — web:$WEB_CODE api:$API_CODE"
pm2 status

if [ "$WEB_CODE" = "200" ] && [ "$API_CODE" = "200" ]; then
  log "Deploy OK"
  exit 0
fi

log "Deploy finished with warnings — check pm2 logs"
exit 1
