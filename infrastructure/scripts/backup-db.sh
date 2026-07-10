#!/bin/bash
# ============================================================
# SPLARO — PostgreSQL Backup Script
# Add to cron: 0 2,14 * * * bash /var/www/splaro/infrastructure/scripts/backup-db.sh
#
# Was silently failing every run: it expected a POSTGRES_PASSWORD env var
# that nothing ever set (the app only has DATABASE_URL), so pg_dump auth
# failed against the literal fallback "CHANGE_ME" and `set -e` exited before
# any backup file existed — no alert, no log anyone was watching, so this
# went unnoticed until the underlying DB was wiped by an unrelated VPS
# rebuild with zero recoverable backup. Now parses creds straight out of the
# app's own .env so there's nothing separate to fall out of sync.
# ============================================================

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
BACKUP_DIR="${SPLARO_BACKUP_DIR:-/var/backups/splaro}"
DB_NAME="splaro_db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

[ -f "$APP_DIR/.env" ] || { echo "ERROR: missing $APP_DIR/.env"; exit 1; }
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$APP_DIR/.env" | cut -d= -f2-)"
[ -n "$DATABASE_URL" ] || { echo "ERROR: DATABASE_URL not set in .env"; exit 1; }

# postgresql://user:pass@host:port/db
DB_USER="$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')"
DB_PASS="$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"
DB_HOST="$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')"
[ -n "$DB_USER" ] && [ -n "$DB_HOST" ] || { echo "ERROR: could not parse DATABASE_URL"; exit 1; }

mkdir -p "$BACKUP_DIR"

echo "Starting backup: $FILENAME"

PGPASSWORD="$DB_PASS" pg_dump \
    -U "$DB_USER" \
    -h "$DB_HOST" \
    -d "$DB_NAME" \
    --no-password \
    --format=plain \
    --no-acl \
    --no-owner \
    | gzip > "$FILENAME"

# pg_dump errors don't always propagate through the pipe — verify the file
# is a real, non-trivial gzip, not a truncated/empty one from a failed dump.
SIZE="$(stat -c%s "$FILENAME" 2>/dev/null || stat -f%z "$FILENAME")"
if [ "$SIZE" -lt 200 ]; then
  echo "ERROR: backup file suspiciously small ($SIZE bytes) — treating as failed"
  exit 1
fi

echo "Backup complete: $(du -sh "$FILENAME" | cut -f1)"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"
