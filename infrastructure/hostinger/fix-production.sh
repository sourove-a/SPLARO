#!/bin/bash
# Apply SPLARO production fixes on Hostinger (API + web proxy + env)
set -euo pipefail

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
NODEJS_DIR="${SPLARO_NODEJS_DIR:-$HOME/domains/splaro.co/nodejs}"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"

log() { echo "[fix-production $(date '+%H:%M:%S')] $*"; }

log "Repo=$REPO"

cd "$REPO"

# ── Clean .env (remove duplicate REDIS_ENABLED, set shared-hosting defaults) ──
if [ -f .env ]; then
  grep -v '^REDIS_ENABLED=' .env > .env.tmp || true
  mv .env.tmp .env
  {
    echo 'REDIS_ENABLED=false'
    echo 'NEXT_PUBLIC_SITE_URL=https://splaro.co'
    echo 'NEXT_PUBLIC_API_URL=https://splaro.co/api/v1'
    echo 'NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co'
    echo 'WEB_URL=https://splaro.co'
    echo 'API_URL=https://splaro.co'
    echo 'CORS_ORIGINS=https://splaro.co,https://admin.splaro.co'
    echo 'API_PORT=4000'
    echo 'PORT=3000'
  } >> .env
  chmod 600 .env
fi

# ── Build API workspace packages ──
log "Building API packages..."
pnpm --filter @splaro/types run build 2>/dev/null || npx tsc -p packages/types/tsconfig.json
pnpm --filter @splaro/config run build 2>/dev/null || npx tsc -p packages/config/tsconfig.json --skipLibCheck || true
if [ -n "${DATABASE_URL:-}" ]; then
  pnpm db:generate 2>/dev/null || true
fi
cd apps/api && npx tsc -p tsconfig.json --skipLibCheck 2>/dev/null || pnpm run build
cd "$REPO"

# ── Patch baked client + SSR URLs (Mac build → production) ──
log "Patching static + server bundles for production URLs..."
for dir in \
  "apps/web/.next/static" \
  "apps/web/.next/server" \
  "apps/web/.next/standalone/apps/web/.next/server"
do
  [ -d "$dir" ] || continue
  find "$dir" -name '*.js' -type f 2>/dev/null | while read -r f; do
    sed -i \
      -e 's|https://api.splaro.co/api/v1|https://splaro.co/api/v1|g' \
      -e 's|https://api.splaro.co|https://splaro.co|g' \
      -e 's|http://127.0.0.1:3000|https://splaro.co|g' \
      -e 's|http://localhost:3000|https://splaro.co|g' \
      "$f" 2>/dev/null || true
  done
done

# ── Passenger stack startup (API + web) ──
mkdir -p "$NODEJS_DIR/tmp"
cp "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" "$NODEJS_DIR/app.cjs"

# ── Restart Passenger ──
mkdir -p "$NODEJS_DIR/tmp"
touch "$NODEJS_DIR/tmp/restart.txt"

log "Waiting for API..."
sleep 8
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health 2>/dev/null || echo 000)"
WEB_HEALTH="$(curl -s -o /dev/null -w '%{http_code}' https://splaro.co/api/v1/health 2>/dev/null || echo 000)"
log "Health — local API:$API_CODE proxied:$WEB_HEALTH"

if [ "$API_CODE" = "200" ]; then
  log "Production fix OK"
else
  log "API not healthy yet — check DATABASE_URL (Neon Postgres required)"
  log "Run: pnpm db:migrate:prod && pnpm db:seed"
fi
