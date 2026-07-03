#!/bin/bash
# User-space PostgreSQL for SPLARO on Hostinger shared hosting (no root).
set -euo pipefail

PGDIR="${SPLARO_PG_DIR:-$HOME/pgsql}"
PGDATA="${PGDATA:-$PGDIR/data}"
PGPORT="${SPLARO_PG_PORT:-5433}"
REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"

log() { echo "[setup-pg $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

mkdir -p "$PGDIR"
cd "$PGDIR"

install_via_conda() {
  local conda="$HOME/miniconda3/bin/conda"
  if [ ! -x "$conda" ]; then
    log "Installing Miniconda (user-space)..."
    curl -fsSL https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -o miniconda.sh
    bash miniconda.sh -b -p "$HOME/miniconda3"
    rm -f miniconda.sh
  fi
  "$HOME/miniconda3/bin/conda" install -y -c conda-forge postgresql=16 2>&1 | tail -5
  mkdir -p "$PGDIR/pgsql/bin"
  ln -sf "$HOME/miniconda3/bin/"* "$PGDIR/pgsql/bin/" 2>/dev/null || true
}

if [ ! -x "$PGDIR/pgsql/bin/postgres" ]; then
  log "Downloading PostgreSQL 16 binaries..."
  ARCHIVE="postgresql-16.4-1-linux-x64-binaries.tar.gz"
  DOWNLOADED=0
  for URL in \
    "https://get.enterprisedb.com/postgresql/${ARCHIVE}" \
    "https://sbp.enterprisedb.com/getfile.jsp?fileid=1258893"; do
    if curl -fsSL -A "Mozilla/5.0" "$URL" -o "$ARCHIVE" && [ -s "$ARCHIVE" ]; then
      if tar -tzf "$ARCHIVE" >/dev/null 2>&1; then
        rm -rf pgsql
        tar -xzf "$ARCHIVE"
        chmod +x pgsql/bin/* 2>/dev/null || true
        DOWNLOADED=1
        break
      fi
    fi
    rm -f "$ARCHIVE"
  done
  if [ "$DOWNLOADED" != "1" ] || [ ! -x "$PGDIR/pgsql/bin/postgres" ]; then
    log "Binary download failed — trying conda-forge PostgreSQL..."
    install_via_conda
  fi
fi

export PATH="$PGDIR/pgsql/bin:$HOME/miniconda3/bin:$PATH"
command -v postgres >/dev/null || die "postgres binary not found after install attempts"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  log "Initializing database cluster at $PGDATA"
  initdb -D "$PGDATA" -U splaro_user --no-locale -E UTF8
  echo "port = $PGPORT" >> "$PGDATA/postgresql.conf"
  echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  echo "max_connections = 20" >> "$PGDATA/postgresql.conf"
fi

if ! pg_isready -h 127.0.0.1 -p "$PGPORT" -q 2>/dev/null; then
  log "Starting PostgreSQL on port $PGPORT"
  pg_ctl -D "$PGDATA" -l "$PGDIR/postgres.log" -o "-p $PGPORT" start
  sleep 3
fi

DB_PASS="${SPLARO_DB_PASS:-$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)}"
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
chmod 600 .env

log "Prisma migrate + seed..."
set -a && source .env && set +a
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push
pnpm db:seed || log "Seed skipped"

touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
log "PostgreSQL ready — password saved in $REPO/.env"
