#!/bin/bash
# User-space PostgreSQL for SPLARO on Hostinger shared hosting (micromamba — reliable)
set -euo pipefail

PGDIR="${SPLARO_PG_DIR:-$HOME/pgsql}"
PGDATA="${PGDATA:-$PGDIR/data}"
PGPORT="${SPLARO_PG_PORT:-5433}"
REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"

log() { echo "[setup-pg $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

install_via_micromamba() {
  log "Installing PostgreSQL 16 via micromamba..."
  mkdir -p "$HOME/mamba" && cd "$HOME/mamba"
  if [ ! -x "$HOME/mamba/bin/micromamba" ]; then
    curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest -o micromamba.tar.bz2
    tar -xjf micromamba.tar.bz2 bin/micromamba
  fi
  export MAMBA_ROOT_PREFIX="$HOME/mamba/env"
  # shellcheck disable=SC1091
  eval "$("$HOME/mamba/bin/micromamba" shell hook -s bash)"
  micromamba create -y -n pg -c conda-forge postgresql=16 2>&1 | tail -8
  export PATH="$MAMBA_ROOT_PREFIX/envs/pg/bin:$PATH"
  cd "$REPO"
}

if ! command -v postgres >/dev/null 2>&1; then
  if [ -x "$HOME/mamba/env/envs/pg/bin/postgres" ]; then
    export PATH="$HOME/mamba/env/envs/pg/bin:$PATH"
  else
    install_via_micromamba
  fi
fi
command -v postgres >/dev/null || die "postgres binary not found"

mkdir -p "$PGDIR"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "Initializing database cluster at $PGDATA (port $PGPORT)..."
  rm -rf "$PGDATA"
  initdb -D "$PGDATA" -U splaro_user --no-locale -E UTF8
  echo "port = $PGPORT" >> "$PGDATA/postgresql.conf"
  echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  echo "max_connections = 25" >> "$PGDATA/postgresql.conf"
fi

if ! pg_isready -h 127.0.0.1 -p "$PGPORT" -q 2>/dev/null; then
  log "Starting PostgreSQL on port $PGPORT"
  pg_ctl -D "$PGDATA" -l "$PGDIR/postgres.log" -o "-p $PGPORT" start
  sleep 4
fi
pg_isready -h 127.0.0.1 -p "$PGPORT" || die "PostgreSQL not running"

DB_PASS="${SPLARO_DB_PASS:-SplaroPg2026Host}"
psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='splaro_db'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -c "CREATE DATABASE splaro_db;"
psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -c "ALTER USER splaro_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || true

DATABASE_URL="postgresql://splaro_user:${DB_PASS}@127.0.0.1:${PGPORT}/splaro_db"
log "DATABASE_URL configured (port $PGPORT)"

cd "$REPO"
if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
else
  echo "DATABASE_URL=${DATABASE_URL}" >> .env
fi
grep -q '^REDIS_ENABLED=' .env && sed -i 's|^REDIS_ENABLED=.*|REDIS_ENABLED=false|' .env || echo 'REDIS_ENABLED=false' >> .env
chmod 600 .env

log "Prisma generate + schema push..."
set -a && source .env && set +a
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$SCHEMA" ] && ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
fi

PRISMA="$REPO/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
[ -f "$PRISMA" ] || PRISMA=$(find "$REPO/node_modules" -path '*/prisma/build/index.js' 2>/dev/null | head -1)

if [ -f "$PRISMA" ]; then
  node "$PRISMA" generate --schema="$SCHEMA" 2>&1 | tail -3
  node "$PRISMA" db push --schema="$SCHEMA" --accept-data-loss 2>&1 | tail -5
else
  pnpm db:generate 2>&1 | tail -3 || true
  pnpm db:push 2>&1 | tail -5 || true
fi

if pnpm db:seed 2>&1 | tail -5; then
  log "Full seed OK"
else
  log "Full seed failed — trying minimal-seed.sql..."
  psql "$DATABASE_URL" -f "$REPO/infrastructure/hostinger/minimal-seed.sql" 2>&1 | tail -5 || true
fi

touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt" 2>/dev/null || mkdir -p "$HOME/domains/splaro.co/nodejs/tmp" && touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
log "PostgreSQL ready — credentials in $REPO/.env"
