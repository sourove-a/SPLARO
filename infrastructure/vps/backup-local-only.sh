#!/bin/bash
# SPLARO VPS — local PostgreSQL backup (no Supabase mirror required)
# Cron: 0 3 * * * bash /var/www/splaro/infrastructure/vps/backup-local-only.sh >> /var/log/splaro/backup.log 2>&1

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
BACKUP_DIR="${SPLARO_BACKUP_DIR:-/var/backups/splaro}"
RETAIN_DAYS="${SPLARO_BACKUP_RETAIN_DAYS:-14}"
DATE="$(date +%F)"
LOG_PREFIX="[backup-local $(date '+%F %T')]"

log() { echo "$LOG_PREFIX $*"; }

mkdir -p "$BACKUP_DIR" /var/log/splaro

DBNAME="${SPLARO_DB_NAME:-splaro_db}"
if [ -f "$APP_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a && source "$APP_DIR/.env" && set +a
  if [ -n "${DATABASE_URL:-}" ]; then
    DBNAME="$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')"
  fi
fi

OUT="$BACKUP_DIR/splaro-${DATE}.sql.gz"
log "Dumping $DBNAME → $OUT"
sudo -u postgres pg_dump --schema=public "$DBNAME" | gzip > "$OUT"
log "OK ($(du -h "$OUT" | cut -f1))"

if [ -d "$APP_DIR/uploads" ]; then
  UP="$BACKUP_DIR/uploads-${DATE}.tar.gz"
  tar -czf "$UP" -C "$APP_DIR" uploads 2>/dev/null && log "Uploads archived" || true
fi

find "$BACKUP_DIR" -name 'splaro-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
log "Done — retained $RETAIN_DAYS days in $BACKUP_DIR"
