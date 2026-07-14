#!/bin/bash
# SPLARO — bootstrap from empty Hostinger account (after file wipe)
# Run via SSH or hPanel Terminal once splaro.co Git deploy path exists.
#
# Prerequisite (hPanel — one time):
#   Websites → splaro.co → Deployments → Connect GitHub → sourove-a/SPLARO → main
#   Build: npm run build | Start: npm start | Node 20 | Framework Express
#   Subdomains: admin.splaro.co + api.splaro.co (Node.js 20 each)
set -euo pipefail

export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$HOME/pgenv/bin:$PATH"

log() { echo "[bootstrap $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
REPO="${SPLARO_REPO_DIR:-$HOME/domains/$DOMAIN/public_html/.builds/source/repository}"
NODEJS="$HOME/domains/$DOMAIN/nodejs"

# ── Wait for hPanel Git deploy to create repo path (max 10 min) ──
if [ ! -d "$REPO/.git" ]; then
  log "Repo not at $REPO — waiting for hPanel Git deploy..."
  for i in $(seq 1 60); do
    if [ -d "$REPO/.git" ]; then break; fi
    if [ -d "$HOME/splaro/.git" ]; then
      REPO="$HOME/splaro"
      log "Using fallback $REPO"
      break
    fi
    sleep 10
  done
fi

if [ ! -d "$REPO/.git" ]; then
  log "Cloning to ~/splaro (hPanel Git path not ready yet)..."
  mkdir -p "$HOME/splaro"
  git clone https://github.com/sourove-a/SPLARO.git "$HOME/splaro"
  REPO="$HOME/splaro"
fi

cd "$REPO"
git fetch origin main && git checkout main && git pull origin main

# ── pnpm ──
bash infrastructure/hostinger/ensure-pnpm.sh
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

# ── PostgreSQL (SPLARO needs Postgres — NOT MySQL) ──
log "PostgreSQL setup..."
bash infrastructure/hostinger/setup-local-postgres.sh || log "PG setup warning"

# ── Production .env ──
if [ ! -f .env ]; then
  bash infrastructure/hostinger/generate-production-env.sh > .env
fi
upsert() { k="${1%%=*}"; grep -q "^${k}=" .env 2>/dev/null && sed -i "s|^${k}=.*|${1}|" .env || echo "$1" >> .env; }
upsert "NODE_ENV=production"
upsert "NEXT_PUBLIC_SITE_URL=https://splaro.co"
upsert "NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1"
upsert "NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co"
upsert "NEXT_PUBLIC_CDN_URL=https://splaro.co"
upsert "WEB_URL=https://splaro.co"
upsert "ADMIN_URL=https://admin.splaro.co"
upsert "API_URL=https://api.splaro.co"
upsert "CORS_ORIGINS=https://splaro.co,https://admin.splaro.co"
upsert "REDIS_ENABLED=false"
upsert "API_PORT=4000"
upsert "INTERNAL_WEB_PORT=3001"
upsert "PORT=3000"
upsert "NEXT_PUBLIC_STORE_ID=splaro"
upsert "PAYMENT_DEV_STUB=false"
chmod 600 .env

# ── Install + build full stack ──
log "Installing dependencies..."
SKIP_SPLARO_POSTINSTALL=1 NODE_ENV=development pnpm install --frozen-lockfile --prod=false --ignore-scripts
find node_modules -type f \( -path '*/.bin/*' -o -path '*/next/dist/bin/next' -o -path '*/prisma/build/index.js' \) -exec chmod +x {} + 2>/dev/null || true

set -a && source .env && set +a
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push
pnpm db:seed || log "Seed skipped"

export NODE_ENV=production SPLARO_HOSTINGER=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

log "Building web..."
SPLARO_HOSTINGER=1 bash scripts/hostinger-build.sh

log "Building admin + API..."
if [ -f apps/admin/next.config.hostinger.mjs ] && [ -f apps/admin/next.config.ts ]; then
  mv apps/admin/next.config.ts apps/admin/next.config.ts.bak
  cp apps/admin/next.config.hostinger.mjs apps/admin/next.config.mjs
fi
pnpm --filter @splaro/admin run build || true
[ -f apps/admin/next.config.ts.bak ] && mv apps/admin/next.config.ts.bak apps/admin/next.config.ts
node scripts/prepare-next-standalone.mjs apps/admin 2>/dev/null || true
pnpm --filter @splaro/api run build || true

# ── Passenger (splaro.co stack) ──
if [ -d "$HOME/domains/$DOMAIN" ]; then
  mkdir -p "$NODEJS/tmp"
  cp infrastructure/hostinger/passenger-stack-app.cjs "$NODEJS/app.cjs"
  touch "$NODEJS/tmp/restart.txt"
  bash infrastructure/hostinger/setup-passenger-admin.sh 2>/dev/null || true
  [ -d "$HOME/domains/api.splaro.co" ] && bash infrastructure/hostinger/setup-passenger-api.sh 2>/dev/null || log "Create api.splaro.co subdomain in hPanel"
  bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true
else
  log "domains/$DOMAIN not found — trigger hPanel Git redeploy, then re-run this script"
fi

sleep 20
log "Health check:"
curl -sf http://127.0.0.1:4000/api/v1/health && echo || echo "api-local: down"
curl -s -o /dev/null -w "web:%{http_code} " https://splaro.co/ || true
curl -s -o /dev/null -w "admin:%{http_code} " https://admin.splaro.co/login || true
curl -s -o /dev/null -w "api:%{http_code}\n" https://api.splaro.co/api/v1/health 2>/dev/null || true
log "Bootstrap done"
