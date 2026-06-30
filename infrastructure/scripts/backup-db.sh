#!/bin/bash
# ============================================================
# SPLARO — PostgreSQL Backup Script
# Add to cron: 0 2 * * * bash /var/www/splaro/infrastructure/scripts/backup-db.sh
# ============================================================

set -euo pipefail

BACKUP_DIR="/var/backups/splaro"
DB_NAME="splaro_db"
DB_USER="splaro_user"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "Starting backup: $FILENAME"

PGPASSWORD="${POSTGRES_PASSWORD:-CHANGE_ME}" pg_dump \
    -U "$DB_USER" \
    -h localhost \
    -d "$DB_NAME" \
    --no-password \
    --format=plain \
    --no-acl \
    --no-owner \
    | gzip > "$FILENAME"

echo "Backup complete: $(du -sh "$FILENAME" | cut -f1)"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"
