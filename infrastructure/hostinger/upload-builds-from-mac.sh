#!/bin/bash
# Upload Mac-built artifacts to Hostinger (when server build fails under load)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${SSH_HOST:-145.79.25.203}"
SSH_PORT="${SSH_PORT:-65002}"
SSH_USER="${SSH_USER:-u134578371}"
REPO_REMOTE='$HOME/domains/splaro.co/public_html/.builds/source/repository'

[ -n "${SSHPASS:-}" ] || { echo "export SSHPASS='...'"; exit 1; }
command -v sshpass >/dev/null || { echo "brew install hudochenkov/sshpass/sshpass"; exit 1; }

for artifact in \
  "$ROOT/apps/web/.next/standalone/apps/web/server.js" \
  "$ROOT/apps/admin/.next/standalone/apps/admin/server.js" \
  "$ROOT/apps/api/dist/main.js"
do
  [ -f "$artifact" ] || { echo "Missing: $artifact — run local build first"; exit 1; }
done

log() { echo "[upload-builds $(date '+%H:%M:%S')] $*"; }

log "Uploading builds via SSH pipe (${SSH_USER}@${SSH_HOST})..."
tar -czf - \
  -C "$ROOT" \
  apps/web/.next/standalone \
  apps/admin/.next/standalone \
  apps/api/dist \
  | sshpass -e ssh -T -p "$SSH_PORT" -o StrictHostKeyChecking=no \
    "${SSH_USER}@${SSH_HOST}" \
    "cd ${REPO_REMOTE} && tar -xzf - && echo EXTRACT_OK"

log "Configuring on server..."
sshpass -e ssh -T -p "$SSH_PORT" -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" << 'REMOTE'
set -euo pipefail
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/pgenv/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
cd "$REPO"

upsert() { k="${1%%=*}"; grep -q "^${k}=" .env 2>/dev/null && sed -i "s|^${k}=.*|${1}|" .env || echo "$1" >> .env; }
upsert "DATABASE_URL=postgresql://splaro_user:IRoiC9VlqPGRrW4dud1t@127.0.0.1:5433/splaro_db"
upsert "NEXT_PUBLIC_SITE_URL=https://splaro.co"
upsert "NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1"
upsert "NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co"
upsert "API_URL=https://api.splaro.co"
upsert "WEB_URL=https://splaro.co"
upsert "ADMIN_URL=https://admin.splaro.co"
upsert "CORS_ORIGINS=https://splaro.co,https://admin.splaro.co"
upsert "REDIS_ENABLED=false"
upsert "API_PORT=4000"
upsert "INTERNAL_WEB_PORT=3001"
chmod 600 .env

$HOME/pgenv/bin/pg_ctl -D $HOME/pgsql/data -l $HOME/pgsql/postgres.log -o "-p 5433" start 2>/dev/null || true

cp infrastructure/hostinger/passenger-stack-app.cjs $HOME/domains/splaro.co/nodejs/app.cjs
touch $HOME/domains/splaro.co/nodejs/tmp/restart.txt
bash infrastructure/hostinger/setup-passenger-admin.sh 2>/dev/null || true
[ -d "$HOME/domains/api.splaro.co" ] && bash infrastructure/hostinger/setup-passenger-api.sh 2>/dev/null || true
bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true

sleep 25
echo "Health:"
curl -s -m 10 -o /dev/null -w "api-local:%{http_code} " http://127.0.0.1:4000/api/v1/health || echo -n "api-local:000 "
curl -s -m 15 -o /dev/null -w "web:%{http_code} " https://splaro.co/ || echo -n "web:000 "
curl -s -m 15 -o /dev/null -w "admin:%{http_code} " https://admin.splaro.co/login || echo -n "admin:000 "
curl -s -m 15 -o /dev/null -w "api:%{http_code}" https://api.splaro.co/api/v1/health 2>/dev/null || echo -n "api:000"
echo
REMOTE

log "Upload complete"
