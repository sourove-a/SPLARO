#!/bin/bash
# SPLARO full live recovery — API + web + admin on Hostinger shared hosting
set -euo pipefail

export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
NODEJS="$HOME/domains/splaro.co/nodejs"
ADMIN_HTDOCS="$HOME/domains/splaro.co/public_html/admin"
API_HTDOCS="$HOME/domains/splaro.co/public_html/api"
WEB="$HOME/splaro-web-full/web-standalone/apps/web"
ADMIN="$HOME/splaro-admin-full/admin-standalone/apps/admin"
WEB_ST="$HOME/splaro-web-full/web-standalone"
ADMIN_ST="$HOME/splaro-admin-full/admin-standalone"
USER_HOME="${HOME:-/home/u134578371}"

log() { echo "[live $(date '+%H:%M:%S')] $*"; }

cd "$REPO" || { log "ERROR: repo missing"; exit 1; }
git pull origin main 2>/dev/null || true

log "=== Step 1: API ==="
bash "$REPO/infrastructure/hostinger/fix-api-only.sh"

log "=== Step 2: Web (:3001) ==="
pkill -f "splaro-web-full.*server.js" 2>/dev/null || true
sleep 2
if [ -f "$WEB/server.js" ]; then
  mkdir -p "$NODEJS"
  cd "$WEB"
  PORT=3001 HOSTNAME=127.0.0.1 \
    NODE_PATH="$WEB_ST/node_modules:$WEB/node_modules:$REPO/node_modules" \
    nohup node server.js >> "$NODEJS/web.log" 2>&1 &
  sleep 8
  log "web local: $(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ || echo fail)"
else
  log "WARN: web standalone missing at $WEB"
fi

log "=== Step 3: Admin (:3002) ==="
pkill -f "splaro-admin-full.*server.js" 2>/dev/null || true
sleep 2
if [ -f "$ADMIN/server.js" ]; then
  mkdir -p "$ADMIN_HTDOCS/nodejs"
  cd "$ADMIN"
  PORT=3002 HOSTNAME=127.0.0.1 \
    NODE_PATH="$ADMIN_ST/node_modules:$ADMIN/node_modules:$REPO/node_modules" \
    nohup node server.js >> "$ADMIN_HTDOCS/nodejs/admin.log" 2>&1 &
  sleep 8
  log "admin local: $(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/login || echo fail)"
else
  log "WARN: admin standalone missing at $ADMIN"
fi

log "=== Step 4: Passenger proxies ==="
mkdir -p "$NODEJS/tmp" "$ADMIN_HTDOCS/nodejs/tmp" "$API_HTDOCS/nodejs/tmp"
cp "$REPO/infrastructure/hostinger/passenger-proxy-only.cjs" "$NODEJS/app.cjs"
cp "$REPO/infrastructure/hostinger/passenger-admin-proxy.cjs" "$ADMIN_HTDOCS/nodejs/app.cjs"
cp "$REPO/infrastructure/hostinger/passenger-api-proxy.cjs" "$API_HTDOCS/nodejs/app.cjs"
touch "$NODEJS/tmp/restart.txt" "$ADMIN_HTDOCS/nodejs/tmp/restart.txt" "$API_HTDOCS/nodejs/tmp/restart.txt"
sleep 15

log "=== Step 5: Public verify ==="
bash "$REPO/infrastructure/hostinger/verify-production.sh" || true
log "=== LIVE RECOVERY DONE ==="
