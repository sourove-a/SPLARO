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
pnpm db:generate

log "Migrate production schema..."
pnpm db:migrate:prod || pnpm db:push

log "Seed database..."
pnpm db:seed || log "Seed skipped — check logs"

log "Restarting Passenger stack..."
touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
sleep 10

PRODUCTS="$(curl -s -m 20 'https://splaro.co/api/v1/storefront/products?storeId=splaro' | head -c 120)"
log "Storefront products sample: $PRODUCTS"
log "Database setup complete"
