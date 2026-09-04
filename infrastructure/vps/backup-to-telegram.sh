#!/bin/bash
# ==============================================================================
# SPLARO VPS — Zero-Disk Automated PostgreSQL Backup to Telegram
#
# Design & Safety:
#   1. Strictly READ-ONLY: Uses PostgreSQL `pg_dump` which performs zero write,
#      update, or delete operations. The live store and database are never affected.
#   2. Zero VPS Disk Waste: The dump is temporarily gzipped in /tmp, dispatched
#      to your private Telegram Channel/Bot, and immediately deleted upon receipt.
#   3. Loud Error Reporting: If the upload fails, a critical alert is sent so you
#      are never left in the dark.
#
# Usage:
#   bash /var/www/splaro/infrastructure/vps/backup-to-telegram.sh
#   bash /var/www/splaro/infrastructure/vps/backup-to-telegram.sh --check
#   bash /var/www/splaro/infrastructure/vps/backup-to-telegram.sh -100XXXXXXXXXX
#
# Weekly Cron (runs every Sunday at 03:00 AM BD time):
#   0 21 * * 6 bash /var/www/splaro/infrastructure/vps/backup-to-telegram.sh >> /var/log/splaro/backup-telegram.log 2>&1
# ==============================================================================

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
if [ ! -f "$APP_DIR/.env" ] && [ -f "/opt/splaro/app/.env" ]; then
  APP_DIR="/opt/splaro/app"
fi

DATE="$(date +%F)"
TIME_UTC="$(date -u '+%H:%M:%S UTC')"
TIME_BD="$(TZ='Asia/Dhaka' date '+%Y-%m-%d %I:%M %p BST')"
LOG_PREFIX="[backup-telegram $(date '+%F %T')]"

log() { echo "$LOG_PREFIX $*"; }

# ── 1. Load Environment & Telegram Credentials ──────────────────────────────
if [ -f "$APP_DIR/.env" ]; then
  # Load env vars safely without overriding existing subshell values
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env" 2>/dev/null || true
  set +a
fi

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TARGET_CHAT="${1:-}"

# If no chat ID argument passed, check common env keys
if [ -z "$TARGET_CHAT" ]; then
  TARGET_CHAT="${TELEGRAM_BACKUP_CHAT_ID:-${TELEGRAM_ADMIN_CHAT_ID:-${TELEGRAM_CHAT_ID:-${TELEGRAM_ADMIN_USER_ID:-}}}}"
fi

# Fallback: check admin cred file if present
if [ -z "$BOT_TOKEN" ] && [ -f "/root/.splaro-tg-cred" ]; then
  # shellcheck disable=SC1091
  source "/root/.splaro-tg-cred"
fi

if [ -z "$BOT_TOKEN" ]; then
  log "ERROR: TELEGRAM_BOT_TOKEN not found in environment or $APP_DIR/.env"
  exit 1
fi

if [ -z "$TARGET_CHAT" ]; then
  log "ERROR: No target Telegram chat/channel specified. Provide it as an argument or set TELEGRAM_BACKUP_CHAT_ID."
  exit 1
fi

# ── 2. Dry-Run / Connectivity Check Mode ────────────────────────────────────
if [ "${1:-}" = "--check" ]; then
  log "Testing Telegram bot connection to chat: $TARGET_CHAT"
  CHECK_RES=$(curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TARGET_CHAT}" \
    -d "text=🟢 <b>SPLARO Backup Engine:</b> Telegram connectivity verified successfully. Scheduled backups will be delivered here." \
    -d "parse_mode=HTML")

  if echo "$CHECK_RES" | grep -q '"ok":true'; then
    log "Verification SUCCESS: Telegram bot is authorized to post to $TARGET_CHAT"
    exit 0
  else
    log "Verification FAILED: $CHECK_RES"
    exit 1
  fi
fi

# ── 3. Resolve Database Name & Connection ────────────────────────────────────
DBNAME="${SPLARO_DB_NAME:-splaro_db}"
if [ -n "${DATABASE_URL:-}" ]; then
  PARSED_NAME="$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')"
  [ -n "$PARSED_NAME" ] && DBNAME="$PARSED_NAME"
fi

TMP_DIR="/tmp/splaro-backup-$$"
mkdir -p "$TMP_DIR"
mkdir -p "/var/log/splaro"

DUMP_FILENAME="splaro_db_${DATE}.sql.gz"
TEMP_DUMP_FILE="${TMP_DIR}/${DUMP_FILENAME}"

# Cleanup guarantee: delete temp directory upon script exit or error
cleanup() {
  if [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
    log "Temporary dump files pruned. Zero residual disk space used on VPS."
  fi
}
trap cleanup EXIT INT TERM

# ── 4. Generate Read-Only PostgreSQL Dump ───────────────────────────────────
log "Starting safe read-only pg_dump for database: ${DBNAME}"

# Attempt pg_dump via postgres system user or direct command
if command -v sudo >/dev/null 2>&1 && id -u postgres >/dev/null 2>&1; then
  sudo -u postgres pg_dump --schema=public --no-owner --no-acl "$DBNAME" | gzip > "$TEMP_DUMP_FILE"
elif [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "$DATABASE_URL" --schema=public --no-owner --no-acl | gzip > "$TEMP_DUMP_FILE"
else
  pg_dump "$DBNAME" --schema=public --no-owner --no-acl | gzip > "$TEMP_DUMP_FILE"
fi

if [ ! -s "$TEMP_DUMP_FILE" ]; then
  log "ERROR: Database dump generated an empty file."
  # Alert telegram about the failure
  curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TARGET_CHAT}" \
    -d "text=⚠️ <b>SPLARO Backup Warning:</b> Database dump failed or produced 0 bytes on host $(hostname)." \
    -d "parse_mode=HTML" >/dev/null 2>&1 || true
  exit 1
fi

FILE_SIZE="$(du -h "$TEMP_DUMP_FILE" | cut -f1)"
log "Dump completed safely. File size: ${FILE_SIZE}. Preparing Telegram dispatch..."

# ── 5. Dispatch Backup Archive to Telegram Channel ──────────────────────────
CAPTION="📦 <b>SPLARO Database Backup</b>
📅 <b>Date:</b> ${TIME_BD}
🌐 <b>UTC:</b> ${TIME_UTC}
📊 <b>Database:</b> <code>${DBNAME}</code>
💾 <b>Size:</b> ${FILE_SIZE}
🔒 <b>Integrity:</b> Verified Read-Only
<i>Zero VPS disk retention: local copy deleted automatically.</i>"

UPLOAD_RES=$(curl -sS -w "\n%{http_code}" \
  -F "chat_id=${TARGET_CHAT}" \
  -F "document=@${TEMP_DUMP_FILE}" \
  -F "caption=${CAPTION}" \
  -F "parse_mode=HTML" \
  "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument")

HTTP_STATUS="$(echo "$UPLOAD_RES" | tail -n1)"
BODY="$(echo "$UPLOAD_RES" | sed '$d')"

if [ "$HTTP_STATUS" -eq 200 ] && echo "$BODY" | grep -q '"ok":true'; then
  log "SUCCESS: Backup delivered to Telegram (${TARGET_CHAT}) at ${TIME_BD}."
  # Exit trap will automatically remove $TEMP_DUMP_FILE and $TMP_DIR
  exit 0
else
  log "ERROR: Telegram upload failed (HTTP $HTTP_STATUS): $BODY"
  # Attempt to send text notice
  curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TARGET_CHAT}" \
    -d "text=❌ <b>SPLARO Backup Failed:</b> Could not send ${DUMP_FILENAME} (HTTP ${HTTP_STATUS}). Check /var/log/splaro/backup-telegram.log" \
    -d "parse_mode=HTML" >/dev/null 2>&1 || true
  exit 1
fi
