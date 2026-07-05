#!/bin/bash
# SPLARO VPS — daily database backup
# 1) Dump Supabase (live) → /opt/splaro/backups/supabase-YYYY-MM-DD.sql.gz
# 2) Mirror restore → local splaro_db (VPS strong copy)
# 3) Dump local → /opt/splaro/backups/local-YYYY-MM-DD.sql.gz
#
# Cron (root): 0 3 * * * bash /opt/splaro/backup-database.sh >> /var/log/splaro/backup.log 2>&1

set -euo pipefail

APP="${SPLARO_APP_DIR:-/opt/splaro/app}"
BACKUP_DIR="/opt/splaro/backups"
RETAIN_DAYS="${SPLARO_BACKUP_RETAIN_DAYS:-14}"
DATE="$(date +%F)"
LOG_PREFIX="[backup $(date '+%F %T')]"

log() { echo "$LOG_PREFIX $*"; }

# Prefer PG17 client for Supabase (server v17)
PG_DUMP="$(command -v pg_dump17 2>/dev/null || true)"
[ -z "$PG_DUMP" ] && [ -x /usr/lib/postgresql/17/bin/pg_dump ] && PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump
[ -z "$PG_DUMP" ] && PG_DUMP="$(command -v pg_dump)"

mkdir -p "$BACKUP_DIR" /var/log/splaro

# ── Credentials ───────────────────────────────────────────────
CRED_FILE="/root/.splaro-db-cred"
[ -f "$CRED_FILE" ] || { log "ERROR: missing $CRED_FILE — run setup-vps-postgres.sh"; exit 1; }
# shellcheck disable=SC1090
source "$CRED_FILE"
DBUSER="${DBUSER:-splaro}"
DBNAME="${DBNAME:-splaro_db}"
DBPASS="${DBPASS:?missing DBPASS}"

if [ -f "$APP/.env" ]; then
  # shellcheck disable=SC1091
  set -a && source "$APP/.env" && set +a
fi

SUPABASE_DIRECT="${DATABASE_URL_SHADOW:-}"
if [ -z "$SUPABASE_DIRECT" ] && [ -n "${DATABASE_URL:-}" ] && [[ "$DATABASE_URL" == *supabase* ]]; then
  SUPABASE_DIRECT="${DATABASE_URL/direct/pooler}"
  SUPABASE_DIRECT="${SUPABASE_DIRECT//6543/5432}"
  SUPABASE_DIRECT="${SUPABASE_DIRECT//pgbouncer=true/}"
fi

LOCAL_URL="postgresql://${DBUSER}:${DBPASS}@127.0.0.1:5432/${DBNAME}"

# ── 1. Supabase dump (live primary) ─────────────────────────
if [ -n "$SUPABASE_DIRECT" ]; then
  SUPABASE_FILE="$BACKUP_DIR/supabase-${DATE}.sql.gz"
  log "Dumping Supabase (public schema) → $SUPABASE_FILE"
  "$PG_DUMP" "$SUPABASE_DIRECT" --schema=public --no-owner --no-acl | gzip > "$SUPABASE_FILE"
  log "Supabase dump OK ($(du -h "$SUPABASE_FILE" | cut -f1))"

  # ── 2. Mirror to local VPS PostgreSQL (clean refresh) ───────
  log "Syncing mirror → local $DBNAME"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DBNAME}' AND pid <> pg_backend_pid();
SQL
  sudo -u postgres dropdb --if-exists "$DBNAME"
  sudo -u postgres createdb "$DBNAME" -O "$DBUSER"
  gunzip -c "$SUPABASE_FILE" | sudo -u postgres psql -d "$DBNAME" -v ON_ERROR_STOP=0 -q 2>/dev/null || true
  sudo -u postgres psql -d "$DBNAME" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA public TO ${DBUSER};
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DBUSER};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DBUSER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DBUSER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DBUSER};
SQL
  LOCAL_STORES="$(sudo -u postgres psql -d "$DBNAME" -t -A -c 'SELECT count(*) FROM "Store"' 2>/dev/null || echo 0)"
  LOCAL_PRODUCTS="$(sudo -u postgres psql -d "$DBNAME" -t -A -c 'SELECT count(*) FROM "Product"' 2>/dev/null || echo 0)"
  log "Local mirror — Store: $LOCAL_STORES, Product: $LOCAL_PRODUCTS"
else
  log "WARN: DATABASE_URL_SHADOW not set — skipping Supabase dump"
fi

# ── 3. Local dump (VPS copy) ────────────────────────────────
LOCAL_FILE="$BACKUP_DIR/local-${DATE}.sql.gz"
log "Dumping local (public) → $LOCAL_FILE"
sudo -u postgres pg_dump --schema=public "$DBNAME" | gzip > "$LOCAL_FILE"
log "Local dump OK ($(du -h "$LOCAL_FILE" | cut -f1))"

# ── 4. Uploads (if present) ─────────────────────────────────
if [ -d "$APP/uploads" ]; then
  UP_FILE="$BACKUP_DIR/uploads-${DATE}.tar.gz"
  tar -czf "$UP_FILE" -C "$APP" uploads 2>/dev/null && log "Uploads archived" || true
fi

# ── 5. Retention ────────────────────────────────────────────
find "$BACKUP_DIR" -name 'supabase-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'local-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'splaro-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true

log "Done — retained last $RETAIN_DAYS days in $BACKUP_DIR"
