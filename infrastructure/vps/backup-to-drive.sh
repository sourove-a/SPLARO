#!/bin/bash
# ============================================================
# SPLARO — off-site PostgreSQL backup to Google Drive
#
# Why this exists: backup-local-only.sh writes into /var/backups on the VPS
# itself. When the box was rebuilt, the backups went with it and nothing was
# recoverable. A backup that lives on the machine it protects is not a backup.
#
# Design notes:
#   * pg_dump -Fc (custom format), not a .sql.gz. One file, internally
#     compressed, and `pg_restore` can pull a single table out of it instead
#     of forcing a full restore.
#   * Uploads to the SAME Drive file id every run. Drive keeps each upload as
#     a revision, so there is one file in the folder with full history behind
#     it — no directory filling up with dated archives.
#   * Fails loudly. The previous script died silently for months; every exit
#     path here reports to Telegram when it is configured.
#
# Setup (once):
#   1. Google Cloud → create a service account → download its JSON key
#   2. Put the key at /opt/splaro/secrets/drive-sa.json (chmod 600)
#   3. In splaro.bd@gmail.com's Drive, create folder "SPLARO Backups"
#   4. Share that folder with the service account's email, Editor access
#      (this way the dump uses YOUR 5TB quota, not the service account's)
#   5. Copy the folder id out of its URL into SPLARO_DRIVE_FOLDER_ID below
#
# Cron (every 6 hours):
#   0 */6 * * * bash /var/www/splaro/infrastructure/vps/backup-to-drive.sh >> /var/log/splaro/backup-drive.log 2>&1
# ============================================================

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
WORK_DIR="${SPLARO_BACKUP_DIR:-/var/backups/splaro}"
SA_KEY="${SPLARO_DRIVE_SA_KEY:-/opt/splaro/secrets/drive-sa.json}"
FOLDER_ID="${SPLARO_DRIVE_FOLDER_ID:-}"
DUMP_NAME="${SPLARO_DUMP_NAME:-splaro_db.dump}"
# Records the Drive file id so later runs update that file instead of adding
# a new one. Delete it to start a fresh revision chain.
ID_FILE="${SPLARO_DRIVE_ID_FILE:-/opt/splaro/secrets/drive-file-id}"

log() { echo "[drive-backup $(date '+%F %T')] $*"; }

# ── Telegram alerting ────────────────────────────────────────
TG_TOKEN="$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
TG_CHAT="$(grep -m1 '^TELEGRAM_ADMIN_CHAT_ID=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"

notify() {
  [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ] || return 0
  curl -sS --max-time 15 -X POST \
    "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -d "chat_id=${TG_CHAT}" \
    --data-urlencode "text=$1" >/dev/null 2>&1 || true
}

die() {
  log "FAILED: $1"
  notify "🔴 SPLARO backup FAILED%0A%0A$1%0A%0AHost: $(hostname)"
  exit 1
}

# ── Preflight ────────────────────────────────────────────────
command -v pg_dump >/dev/null || die "pg_dump not installed"
command -v python3 >/dev/null || die "python3 not installed"
[ -f "$SA_KEY" ]   || die "Service account key missing: $SA_KEY"
[ -n "$FOLDER_ID" ] || die "SPLARO_DRIVE_FOLDER_ID not set"
[ -f "$APP_DIR/.env" ] || die "Missing $APP_DIR/.env"

python3 -c "import google.oauth2.service_account, googleapiclient.discovery" 2>/dev/null \
  || die "Python Drive libs missing. Install: pip3 install google-api-python-client google-auth"

DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$APP_DIR/.env" | cut -d= -f2-)"
[ -n "$DATABASE_URL" ] || die "DATABASE_URL not set in .env"

mkdir -p "$WORK_DIR" "$(dirname "$ID_FILE")"
DUMP_PATH="$WORK_DIR/$DUMP_NAME"

# ── Dump ─────────────────────────────────────────────────────
log "Dumping database (custom format)..."
# --clean/--if-exists so the dump can be restored straight over an existing DB.
pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 \
        --no-owner --no-privileges --clean --if-exists \
        --file="$DUMP_PATH" \
  || die "pg_dump failed"

SIZE_BYTES="$(stat -c%s "$DUMP_PATH" 2>/dev/null || stat -f%z "$DUMP_PATH")"
SIZE_H="$(du -h "$DUMP_PATH" | cut -f1)"

# A dump that is suspiciously small usually means auth succeeded but the
# schema was empty — worse than a hard failure, because it looks like success.
[ "$SIZE_BYTES" -gt 10240 ] || die "Dump only ${SIZE_BYTES} bytes — refusing to upload a likely-empty backup"

# Verify the archive is readable before it replaces a good revision on Drive.
pg_restore --list "$DUMP_PATH" >/dev/null 2>&1 || die "Dump is corrupt (pg_restore --list failed)"

log "Dump OK — $SIZE_H"

# ── Upload (same file id ⇒ Drive keeps revisions) ────────────
log "Uploading to Google Drive..."
DRIVE_OUT="$(
  SA_KEY="$SA_KEY" FOLDER_ID="$FOLDER_ID" DUMP_PATH="$DUMP_PATH" \
  DUMP_NAME="$DUMP_NAME" ID_FILE="$ID_FILE" python3 <<'PY' 2>&1
import os, sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

key, folder = os.environ["SA_KEY"], os.environ["FOLDER_ID"]
path, name  = os.environ["DUMP_PATH"], os.environ["DUMP_NAME"]
id_file     = os.environ["ID_FILE"]

creds = service_account.Credentials.from_service_account_file(
    key, scopes=["https://www.googleapis.com/auth/drive"])
svc = build("drive", "v3", credentials=creds, cache_discovery=False)

file_id = None
if os.path.exists(id_file):
    file_id = open(id_file).read().strip() or None

# Confirm the remembered id still exists; it may have been trashed by hand.
if file_id:
    try:
        svc.files().get(fileId=file_id, fields="id,trashed",
                        supportsAllDrives=True).execute()
    except Exception:
        file_id = None

# Fall back to matching by name inside the folder before creating a new file,
# so a lost id file does not orphan the existing revision history.
if not file_id:
    q = (f"name='{name}' and '{folder}' in parents and trashed=false")
    hits = svc.files().list(q=q, fields="files(id)", pageSize=1,
                            supportsAllDrives=True,
                            includeItemsFromAllDrives=True).execute().get("files", [])
    if hits:
        file_id = hits[0]["id"]

media = MediaFileUpload(path, mimetype="application/octet-stream", resumable=True)

if file_id:
    # keepRevisionForever pins this revision so Drive will not prune it.
    f = svc.files().update(fileId=file_id, media_body=media,
                           keepRevisionForever=True,
                           fields="id,size", supportsAllDrives=True).execute()
    action = "updated"
else:
    f = svc.files().create(body={"name": name, "parents": [folder]},
                           media_body=media, fields="id,size",
                           supportsAllDrives=True).execute()
    action = "created"
    with open(id_file, "w") as fh:
        fh.write(f["id"])
    os.chmod(id_file, 0o600)

print(f"{action}:{f['id']}")
PY
)" || die "Drive upload failed:%0A$DRIVE_OUT"

case "$DRIVE_OUT" in
  updated:*|created:*) : ;;
  *) die "Drive upload failed:%0A$DRIVE_OUT" ;;
esac

FILE_ID="${DRIVE_OUT#*:}"
log "Upload OK (${DRIVE_OUT%%:*}) — file id $FILE_ID"

notify "✅ SPLARO backup OK%0A%0ASize: $SIZE_H%0AHost: $(hostname)%0ADrive file: $DUMP_NAME"
log "Done."
