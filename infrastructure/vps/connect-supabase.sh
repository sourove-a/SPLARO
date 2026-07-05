#!/bin/bash
# SPLARO — migrate PostgreSQL → Supabase
# Run on VPS as root after creating Supabase project.
#
# Required env (from Supabase → Project Settings → Database):
#   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
#   SUPABASE_DIRECT_URL=postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres
#
# Usage:
#   SUPABASE_DIRECT_URL='postgresql://...' bash infrastructure/vps/connect-supabase.sh

set -euo pipefail

APP="${SPLARO_APP_DIR:-/opt/splaro/app}"
BACKUP="/opt/splaro/backups/pre-supabase-$(date +%F-%H%M).sql.gz"

[ -n "${SUPABASE_DIRECT_URL:-}" ] || {
  echo "ERROR: Set SUPABASE_DIRECT_URL (direct connection, port 5432)"
  echo "Supabase → Settings → Database → Connection string → URI → Direct"
  exit 1
}

log() { echo "[supabase] $*"; }

log "Backup local splaro_db..."
source /root/.splaro-db-cred 2>/dev/null || true
export PGPASSWORD="${DBPASS:-}"
mkdir -p /opt/splaro/backups
pg_dump -U splaro -h 127.0.0.1 splaro_db | gzip > "$BACKUP"
log "Saved $BACKUP"

log "Push schema to Supabase..."
cd "$APP"
export DATABASE_URL="$SUPABASE_DIRECT_URL"
export DATABASE_URL_SHADOW="$SUPABASE_DIRECT_URL"
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push

log "Restore data..."
gunzip -c "$BACKUP" | psql "$SUPABASE_DIRECT_URL" -v ON_ERROR_STOP=1 2>/dev/null || {
  log "Full restore may skip existing schema — data-only if needed"
}

POOL_URL="${SUPABASE_DB_URL:-$SUPABASE_DIRECT_URL}"

log "Update .env..."
cd "$APP"
python3 <<PY
import os, re
path = ".env"
pool = os.environ.get("SUPABASE_DB_URL") or os.environ["SUPABASE_DIRECT_URL"]
direct = os.environ["SUPABASE_DIRECT_URL"]
keys = {
    "DATABASE_URL": pool,
    "DATABASE_URL_SHADOW": direct,
    "SUPABASE_URL": os.environ.get("SUPABASE_URL", "https://paedpsukydmggkpsjwrc.supabase.co"),
    "SUPABASE_ANON_KEY": os.environ.get("SUPABASE_ANON_KEY", ""),
    "SUPABASE_SERVICE_ROLE_KEY": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    "NEXT_PUBLIC_SUPABASE_URL": os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://paedpsukydmggkpsjwrc.supabase.co"),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
}
text = open(path).read() if os.path.isfile(path) else ""
for k, v in keys.items():
    if not v:
        continue
    line = f"{k}={v}"
    if re.search(rf"^{re.escape(k)}=", text, re.M):
        text = re.sub(rf"^{re.escape(k)}=.*$", line, text, flags=re.M)
    else:
        text = text.rstrip() + "\n" + line + "\n"
open(path, "w").write(text)
PY
chmod 600 .env

log "Restart API..."
pm2 reload splaro-api --update-env

log "Health check..."
sleep 4
curl -sf http://127.0.0.1:4000/api/v1/health && echo " OK"

log "Done — DATABASE_URL now points to Supabase"
