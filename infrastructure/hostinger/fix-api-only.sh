#!/bin/bash
# Fix SPLARO API only on Hostinger — run via SSH (one service, low memory)
set -euo pipefail

export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
NODEJS="$HOME/domains/splaro.co/nodejs"
API_HTDOCS="$HOME/domains/splaro.co/public_html/api"
PGDATA="${PGDATA:-$HOME/pgsql/data}"
PGPORT="${SPLARO_PG_PORT:-5433}"
USER_HOME="${HOME:-/home/u134578371}"

log() { echo "[fix-api $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

cd "$REPO" || die "Repo missing at $REPO"

# ── 1. PostgreSQL (micromamba) ──
if ! command -v postgres >/dev/null 2>&1; then
  log "Installing PostgreSQL via micromamba..."
  mkdir -p "$HOME/mamba" && cd "$HOME/mamba"
  if [ ! -x "$HOME/mamba/bin/micromamba" ]; then
    curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest -o micromamba.tar.bz2
    tar -xjf micromamba.tar.bz2 bin/micromamba
  fi
  export MAMBA_ROOT_PREFIX="$HOME/mamba/env"
  eval "$("$HOME/mamba/bin/micromamba" shell hook -s bash)"
  micromamba create -y -n pg -c conda-forge postgresql=16 2>&1 | tail -5
  export PATH="$MAMBA_ROOT_PREFIX/envs/pg/bin:$PATH"
  cd "$REPO"
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "Initializing PostgreSQL at $PGDATA (port $PGPORT)..."
  rm -rf "$PGDATA"
  initdb -D "$PGDATA" -U splaro_user --no-locale -E UTF8
  echo "port = $PGPORT" >> "$PGDATA/postgresql.conf"
  echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  echo "max_connections = 25" >> "$PGDATA/postgresql.conf"
fi

if ! pg_isready -h 127.0.0.1 -p "$PGPORT" -q 2>/dev/null; then
  pg_ctl -D "$PGDATA" -l "$HOME/pgsql/postgres.log" -o "-p $PGPORT" start
  sleep 4
fi
pg_isready -h 127.0.0.1 -p "$PGPORT" || die "PostgreSQL not running on port $PGPORT"

DB_PASS="${SPLARO_DB_PASS:-SplaroPg2026Host}"
psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='splaro_db'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -c "CREATE DATABASE splaro_db;"
psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -c "ALTER USER splaro_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || true

DATABASE_URL="postgresql://splaro_user:${DB_PASS}@127.0.0.1:${PGPORT}/splaro_db"
if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
else
  echo "DATABASE_URL=${DATABASE_URL}" >> .env
fi
grep -q '^REDIS_ENABLED=' .env && sed -i 's|^REDIS_ENABLED=.*|REDIS_ENABLED=false|' .env || echo 'REDIS_ENABLED=false' >> .env
grep -q '^API_PORT=' .env && sed -i 's|^API_PORT=.*|API_PORT=4000|' .env || echo 'API_PORT=4000' >> .env
chmod 600 .env
set -a && source .env && set +a
log "DATABASE_URL → 127.0.0.1:${PGPORT}/splaro_db"

# ── 2. Prisma binary target (Linux OpenSSL 3) ──
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$SCHEMA" ] && ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
fi

# ── 3. Dependencies (API + database only) ──
log "Installing API dependencies (filtered, no postinstall)..."
pnpm install --filter @splaro/api... --filter @splaro/database... --no-frozen-lockfile --ignore-scripts 2>&1 | tail -8
export PATH="$REPO/node_modules/.bin:$PATH"

PRISMA="$REPO/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
[ -f "$PRISMA" ] || PRISMA=$(find "$REPO/node_modules" -path '*/prisma/build/index.js' 2>/dev/null | head -1)

log "Prisma generate + schema push..."
if [ -f "$PRISMA" ]; then
  node "$PRISMA" generate --schema="$SCHEMA" 2>&1 | tail -3
  node "$PRISMA" db push --schema="$SCHEMA" --accept-data-loss 2>&1 | tail -5
else
  pnpm db:generate 2>&1 | tail -3
  pnpm db:push 2>&1 | tail -5
fi
pnpm db:seed 2>&1 | tail -4 || log "Seed skipped (non-fatal)"

# ── 4. Build API ──
log "Building API..."
pnpm --filter @splaro/api run build 2>&1 | tail -6
[ -f "$REPO/apps/api/dist/main.js" ] || die "API build failed — dist/main.js missing"

# ── 5. Start API on :4000 ──
log "Starting API on :4000..."
pkill -f "apps/api/dist/main.js" 2>/dev/null || true
sleep 2
mkdir -p "$NODEJS"
cd "$REPO/apps/api"
API_PORT=4000 nohup node dist/main.js >> "$NODEJS/api.log" 2>&1 &
sleep 12

HEALTH=$(curl -s -m 15 "http://127.0.0.1:4000/api/v1/health" 2>/dev/null || echo "FAIL")
log "Local health: $HEALTH"
echo "$HEALTH" | grep -qi 'ok\|healthy\|status' || {
  log "API not healthy — last log lines:"
  tail -20 "$NODEJS/api.log" 2>/dev/null || true
  die "API failed to start"
}

# ── 6. Passenger proxy (api.splaro.co + splaro.co/api) ──
mkdir -p "$API_HTDOCS/nodejs/tmp" "$NODEJS/tmp"
cp "$REPO/infrastructure/hostinger/passenger-api-proxy.cjs" "$API_HTDOCS/nodejs/app.cjs"
cp "$REPO/infrastructure/hostinger/passenger-proxy-only.cjs" "$NODEJS/app.cjs"
touch "$API_HTDOCS/nodejs/tmp/restart.txt" "$NODEJS/tmp/restart.txt"
sleep 10

PUB=$(curl -s -m 20 "https://splaro.co/api/v1/health" 2>/dev/null | head -c 120)
log "Public health: $PUB"
log "=== API FIX DONE ==="
