#!/bin/bash
# SPLARO fresh deploy — splaro.co + admin.splaro.co + api.splaro.co
# Run on Hostinger via SSH or hPanel terminal.
#
# Usage:
#   bash infrastructure/hostinger/fresh-deploy-splaro-co.sh
set -euo pipefail

DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
REPO="${SPLARO_REPO_DIR:-$HOME/domains/$DOMAIN/public_html/.builds/source/repository}"
NODEJS_DIR="${SPLARO_NODEJS_DIR:-$HOME/domains/$DOMAIN/nodejs}"
export PATH="$HOME/pgenv/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"

log() { echo "[fresh-deploy $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# ── 1. Clean unnecessary files (free disk) ──
log "Cleaning old deploy artifacts..."
rm -rf "$HOME/domains/$DOMAIN/deploy-web" 2>/dev/null || true
rm -f "$HOME/splaro-web-standalone.tar.gz" "$HOME/micromamba.tar.bz2" 2>/dev/null || true

# Old static admin (pre-Next.js) — safe to remove after fresh deploy
for stale in "$HOME/public_html/admin" "$HOME/public_html/api" "$HOME/public_html/assets"; do
  if [ -d "$stale" ]; then
    log "Removing stale: $stale"
    rm -rf "$stale"
  fi
done

for stale in \
  "$HOME/domains/admin.splaro.co/admin" \
  "$HOME/domains/admin.splaro.co/api" \
  "$HOME/domains/admin.splaro.co/assets" \
  "$HOME/domains/admin.splaro.co/public_html/admin" \
  "$HOME/domains/admin.splaro.co/public_html/api"
do
  [ -d "$stale" ] && rm -rf "$stale" && log "Removed $stale"
done

# Prune turbo/next caches if present
find "$REPO" -maxdepth 4 -type d -name '.turbo' -exec rm -rf {} + 2>/dev/null || true

FREED="$(du -sh "$HOME" 2>/dev/null | awk '{print $1}')"
log "Home usage after cleanup: $FREED"

# ── 2. Pull latest code ──
[ -d "$REPO/.git" ] || die "Repo not found at $REPO — connect Git deploy in hPanel first"
cd "$REPO"
log "Pulling latest from main..."
git fetch origin main
git checkout main
git pull origin main

# ── 3. Production .env (splaro.co domains) ──
if [ ! -f .env ]; then
  bash infrastructure/hostinger/generate-production-env.sh > .env
  log "Generated new .env — review secrets"
fi

upsert_env() {
  local key="${1%%=*}"
  local line="$1"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${line}|" .env
  else
    echo "$line" >> .env
  fi
}

upsert_env 'NODE_ENV=production'
upsert_env 'NEXT_PUBLIC_SITE_URL=https://splaro.co'
upsert_env 'NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1'
upsert_env 'NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co'
upsert_env 'NEXT_PUBLIC_CDN_URL=https://splaro.co'
upsert_env 'WEB_URL=https://splaro.co'
upsert_env 'ADMIN_URL=https://admin.splaro.co'
upsert_env 'API_URL=https://api.splaro.co'
upsert_env 'CORS_ORIGINS=https://splaro.co,https://admin.splaro.co'
upsert_env 'REDIS_ENABLED=false'
upsert_env 'API_PORT=4000'
upsert_env 'INTERNAL_WEB_PORT=3001'
upsert_env 'PORT=3000'
upsert_env 'NEXT_PUBLIC_STORE_ID=splaro'
upsert_env 'PAYMENT_DEV_STUB=false'
chmod 600 .env

# ── 4. PostgreSQL (SPLARO uses Postgres, NOT MySQL) ──
log "Setting up PostgreSQL..."
if [ -f infrastructure/hostinger/setup-local-postgres.sh ]; then
  bash infrastructure/hostinger/setup-local-postgres.sh || log "PostgreSQL setup warning — check DATABASE_URL"
fi

# ── 5. Install + build ──
bash infrastructure/hostinger/ensure-pnpm.sh
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

log "Installing dependencies..."
SKIP_SPLARO_POSTINSTALL=1 NODE_ENV=development pnpm install --frozen-lockfile --prod=false --ignore-scripts

find "$REPO/node_modules" -type f \( -path '*/.bin/*' -o -path '*/next/dist/bin/next' -o -path '*/prisma/build/index.js' \) -exec chmod +x {} + 2>/dev/null || true

set -a && source .env && set +a

log "Prisma generate + migrate..."
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push
pnpm db:seed || log "Seed skipped"

export NODE_ENV=production
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
export SPLARO_HOSTINGER=1

log "Building API..."
pnpm --filter @splaro/types run build 2>/dev/null || true
pnpm --filter @splaro/api run build

log "Building admin..."
if [ -f apps/admin/next.config.mjs ] && [ -f apps/admin/next.config.ts ]; then
  mv apps/admin/next.config.ts apps/admin/next.config.ts.hostinger-bak
fi
pnpm --filter @splaro/admin run build || {
  NEXT_BIN=$(find node_modules -path '*/next/dist/bin/next' 2>/dev/null | head -1)
  (cd apps/admin && node "$NEXT_BIN" build)
}
[ -f apps/admin/next.config.ts.hostinger-bak ] && mv apps/admin/next.config.ts.hostinger-bak apps/admin/next.config.ts

node scripts/prepare-next-standalone.mjs apps/admin

log "Building web (if missing)..."
if [ ! -f apps/web/.next/standalone/apps/web/server.js ]; then
  if [ -f apps/web/next.config.mjs ] && [ -f apps/web/next.config.ts ]; then
    mv apps/web/next.config.ts apps/web/next.config.ts.hostinger-bak
  fi
  pnpm --filter @splaro/web run build
  [ -f apps/web/next.config.ts.hostinger-bak ] && mv apps/web/next.config.ts.hostinger-bak apps/web/next.config.ts
  node scripts/prepare-next-standalone.mjs apps/web
fi

for artifact in \
  "apps/web/.next/standalone/apps/web/server.js" \
  "apps/admin/.next/standalone/apps/admin/server.js" \
  "apps/api/dist/main.js"
do
  [ -f "$artifact" ] || die "Build artifact missing: $artifact"
done
log "All build artifacts OK"

# ── 6. Earth textures ──
bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true

# ── 7. Passenger: splaro.co (web + API proxy) ──
log "Configuring splaro.co Passenger stack..."
mkdir -p "$NODEJS_DIR/tmp"
cp infrastructure/hostinger/passenger-stack-app.cjs "$NODEJS_DIR/app.cjs"
touch "$NODEJS_DIR/tmp/restart.txt"

# ── 8. Passenger: admin.splaro.co ──
log "Configuring admin.splaro.co..."
bash infrastructure/hostinger/setup-passenger-admin.sh || log "Admin passenger warning — check subdomain"

# ── 9. Passenger: api.splaro.co (if subdomain exists) ──
if [ -d "$HOME/domains/api.splaro.co" ]; then
  log "Configuring api.splaro.co..."
  bash infrastructure/hostinger/setup-passenger-api.sh || log "API passenger warning"
else
  log "SKIP api.splaro.co — create subdomain in hPanel → Subdomains → api.splaro.co"
  log "Then re-run: bash infrastructure/hostinger/setup-passenger-api.sh"
fi

# ── 10. Health checks ──
log "Waiting for services..."
sleep 20

API_LOCAL="$(curl -s -m 15 -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health 2>/dev/null || echo 000)"
WEB_HOME="$(curl -s -m 20 -o /dev/null -w '%{http_code}' https://splaro.co/ 2>/dev/null || echo 000)"
WEB_API="$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://splaro.co/api/v1/health 2>/dev/null || echo 000)"
ADMIN="$(curl -s -m 20 -o /dev/null -w '%{http_code}' https://admin.splaro.co/login 2>/dev/null || echo 000)"
API_SUB="$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://api.splaro.co/api/v1/health 2>/dev/null || echo 000)"

log "Health — web:$WEB_HOME api-proxy:$WEB_API api-local:$API_LOCAL admin:$ADMIN api-sub:$API_SUB"

echo ""
echo "══════════════════════════════════════════"
echo "  SPLARO deploy complete — splaro.co"
echo "══════════════════════════════════════════"
echo "  Storefront:  https://splaro.co          → $WEB_HOME"
echo "  Admin:       https://admin.splaro.co    → $ADMIN"
echo "  API:         https://api.splaro.co      → $API_SUB"
echo "  API (proxy): https://splaro.co/api/v1   → $WEB_API"
echo ""
echo "  DB: PostgreSQL :5433 (NOT MySQL — Prisma needs Postgres)"
echo "  MySQL u134578371_SPLARO is unused by SPLARO API"
echo "══════════════════════════════════════════"

[ "$WEB_HOME" = "200" ] && [ "$API_LOCAL" = "200" ] || die "Core health check failed — see pm2/passenger logs"
