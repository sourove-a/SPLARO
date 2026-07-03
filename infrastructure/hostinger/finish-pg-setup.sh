#!/bin/bash
set -euo pipefail
export PATH="$HOME/pgenv/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"
PGDIR="$HOME/pgsql"
PGDATA="$PGDIR/data"
PGPORT=5433
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"

log() { echo "[finish-pg $(date '+%H:%M:%S')] $*"; }

mkdir -p "$PGDIR"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "initdb..."
  initdb -D "$PGDATA" -U splaro_user --no-locale -E UTF8
  echo "port = $PGPORT" >> "$PGDATA/postgresql.conf"
  echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  echo "max_connections = 20" >> "$PGDATA/postgresql.conf"
fi

if ! pg_isready -h 127.0.0.1 -p "$PGPORT" -q 2>/dev/null; then
  log "starting postgres on $PGPORT..."
  pg_ctl -D "$PGDATA" -l "$PGDIR/postgres.log" -o "-p $PGPORT" start
  sleep 4
fi
pg_isready -h 127.0.0.1 -p "$PGPORT"

DB_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='splaro_db'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -c "CREATE DATABASE splaro_db;"
psql -h 127.0.0.1 -p "$PGPORT" -U splaro_user -d postgres -c "ALTER USER splaro_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || true

DATABASE_URL="postgresql://splaro_user:${DB_PASS}@127.0.0.1:${PGPORT}/splaro_db"
log "DATABASE_URL set (port $PGPORT)"
cd "$REPO"
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
chmod 600 .env

set -a && source .env && set +a
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push
pnpm db:seed || log "seed skipped"

touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
sleep 10
curl -s -m 20 "https://splaro.co/api/v1/storefront/products?storeId=splaro" | head -c 500
echo
