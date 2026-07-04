#!/bin/bash
# Configure Neon PostgreSQL for SPLARO on Hostinger shared hosting.
# Usage:
#   export DATABASE_URL='postgresql://user:pass@ep-xxx.neon.tech/splaro_db?sslmode=require'
#   bash infrastructure/hostinger/setup-database.sh
set -euo pipefail

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"

log() { echo "[setup-db $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

cd "$REPO"

if [ -z "${DATABASE_URL:-}" ]; then
  die "Set DATABASE_URL to a remote Postgres (Neon recommended). Example:
  export DATABASE_URL='postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/splaro_db?sslmode=require'
  Get one free at https://console.neon.tech"
fi

if [[ "${DATABASE_URL}" == *"127.0.0.1"* ]] || [[ "${DATABASE_URL}" == *"localhost"* ]]; then
  die "DATABASE_URL must point to remote Postgres (Neon/Supabase). Local Postgres is not available on shared hosting."
fi

log "Updating .env DATABASE_URL..."
if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
else
  echo "DATABASE_URL=${DATABASE_URL}" >> .env
fi
chmod 600 .env

log "Prisma generate..."
set -a && source .env && set +a
PRISMA="$REPO/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$PRISMA" ] && [ -f "$SCHEMA" ]; then
  node "$PRISMA" generate --schema="$SCHEMA"
else
  pnpm db:generate
fi

log "Migrate production schema..."
if [ -f "$PRISMA" ]; then
  node "$PRISMA" db push --schema="$SCHEMA" --accept-data-loss 2>/dev/null || \
    node "$PRISMA" migrate deploy --schema="$SCHEMA" 2>/dev/null || \
    pnpm db:push
else
  pnpm db:migrate:prod || pnpm db:push
fi

log "Seed database..."
if pnpm db:seed 2>&1 | tail -5; then
  log "Full seed OK"
else
  log "Full seed failed — trying minimal-seed.sql..."
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -f "$REPO/infrastructure/hostinger/minimal-seed.sql" 2>&1 | tail -5 || true
  else
    log "psql not found — seed manually or re-run from machine with psql"
  fi
fi

log "Restarting API (pick up DATABASE_URL)..."
pkill -f "apps/api/dist/main.js" 2>/dev/null || true
sleep 2
cd "$REPO/apps/api"
API_PORT=4000 nohup node dist/main.js >> "$HOME/domains/splaro.co/nodejs/api.log" 2>&1 &
sleep 8

PRODUCTS="$(curl -s -m 20 'https://splaro.co/api/v1/storefront/products?storeId=splaro' | head -c 120)"
log "Storefront products sample: $PRODUCTS"
log "Database setup complete"
