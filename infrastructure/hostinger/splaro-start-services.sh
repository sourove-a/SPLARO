#!/bin/bash
# Start SPLARO web + API + admin + Passenger proxies (run after reboot or deploy)
set +e
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"

# hPanel has used two checkout layouts — pick whichever holds the workspace.
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
[ -f "$REPO/pnpm-workspace.yaml" ] || REPO="$HOME/domains/splaro.co/nodejs"
NODEJS="$HOME/domains/splaro.co/nodejs"
ADMIN_HTDOCS="$HOME/domains/splaro.co/public_html/admin"
API_HTDOCS="$HOME/domains/splaro.co/public_html/api"
WEB_STANDALONE="$REPO/apps/web/.next/standalone/apps/web"
ADMIN_STANDALONE="$REPO/apps/admin/.next/standalone/apps/admin"
NEXT_BIN=$(find "$REPO/node_modules" -path '*/next/dist/bin/next' 2>/dev/null | head -1)
USER_HOME="${HOME:-/home/u134578371}"
log() { echo "[splaro-start $(date '+%H:%M:%S')] $*"; }

cd "$REPO"
[ -f .env ] && set -a && source .env && set +a
export SPLARO_HOSTINGER=1
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:4000/api/v1}"

# PostgreSQL :5433 — only when DATABASE_URL points at local Postgres (not Supabase/Neon)
if [[ "${DATABASE_URL:-}" != *"supabase.co"* ]] && [[ "${DATABASE_URL:-}" != *"neon.tech"* ]]; then
  export PATH="$HOME/pgenv/bin:$PATH"
  PGDATA="${PGDATA:-$HOME/pgsql/data}"
  if [ -d "$PGDATA" ] && ! pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
    log "Starting local PostgreSQL on :5433"
    pg_ctl -D "$PGDATA" -l "$HOME/pgsql/postgres.log" -o "-p 5433" start >/dev/null 2>&1 || true
    sleep 2
  fi
fi

# Sync .next for next start
if [ -d "$WEB_STANDALONE/.next" ]; then
  mkdir -p "$REPO/apps/web/.next"
  rsync -a "$WEB_STANDALONE/.next/" "$REPO/apps/web/.next/" 2>/dev/null || true
fi
if [ -d "$ADMIN_STANDALONE/.next" ]; then
  mkdir -p "$REPO/apps/admin/.next"
  rsync -a "$ADMIN_STANDALONE/.next/" "$REPO/apps/admin/.next/" 2>/dev/null || true
fi

if [ "${SPLARO_SKIP_SERVICE_FORK:-0}" != "1" ]; then
# Web (:3001)
if ! curl -sf -m 3 "http://127.0.0.1:3001/" >/dev/null 2>&1; then
  log "Starting web on :3001"
  pkill -f "apps/web.*next/dist/bin/next start" 2>/dev/null || true
  pkill -f "apps/web/.next/standalone.*server.js" 2>/dev/null || true
  sleep 2
  cd "$REPO/apps/web"
  PORT=3001 HOSTNAME=127.0.0.1 nohup node "$NEXT_BIN" start >> "$NODEJS/web.log" 2>&1 &
  sleep 8
fi

# API (:4000)
if ! curl -sf -m 3 "http://127.0.0.1:4000/api/v1/health" >/dev/null 2>&1; then
  log "Starting API on :4000"
  pkill -f "apps/api/dist/main.js" 2>/dev/null || true
  sleep 2
  cd "$REPO/apps/api"
  SPLARO_HOSTINGER=1 SPLARO_TELEGRAM_POLLING=1 API_PORT=4000 INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:4000/api/v1}" nohup node dist/main.js >> "$NODEJS/api.log" 2>&1 &
  sleep 8
fi

# Admin (:3002)
if [ -d "$REPO/apps/admin/.next" ] && ! curl -sf -m 3 "http://127.0.0.1:3002/login" >/dev/null 2>&1; then
  log "Starting admin on :3002"
  mkdir -p "$ADMIN_HTDOCS/nodejs"
  pkill -f "apps/admin.*next start" 2>/dev/null || true
  sleep 2
  cd "$REPO/apps/admin"
  PORT=3002 HOSTNAME=127.0.0.1 nohup node "$NEXT_BIN" start >> "$ADMIN_HTDOCS/nodejs/admin.log" 2>&1 &
  sleep 8
fi

# Passenger: splaro.co (legacy path — activate-hostinger-site uses stack-app)
mkdir -p "$NODEJS/tmp"
if [ -f "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" ]; then
  cp "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" "$NODEJS/app.cjs"
else
  cp "$REPO/infrastructure/hostinger/passenger-proxy-only.cjs" "$NODEJS/app.cjs"
fi
touch "$NODEJS/tmp/restart.txt"
log "splaro.co Passenger app restarted"
else
  log "skip manual service fork (passenger-stack-app handles api/web/admin)"
fi

# Passenger: admin (hPanel subfolder public_html/admin)
if [ -d "$ADMIN_HTDOCS" ]; then
  mkdir -p "$ADMIN_HTDOCS/nodejs/tmp"
  cp "$REPO/infrastructure/hostinger/passenger-admin-proxy.cjs" "$ADMIN_HTDOCS/nodejs/app.cjs"
  cat > "$ADMIN_HTDOCS/.htaccess" <<EOF
PassengerAppRoot ${USER_HOME}/domains/splaro.co/public_html/admin/nodejs
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${USER_HOME}/domains/splaro.co/public_html/admin/nodejs/tmp
DirectoryIndex disabled
EOF
  touch "$ADMIN_HTDOCS/nodejs/tmp/restart.txt"
  log "admin.splaro.co proxy configured"
fi

# Passenger: api (hPanel subfolder public_html/api)
if [ -d "$API_HTDOCS" ]; then
  mkdir -p "$API_HTDOCS/nodejs/tmp"
  # MUST be the combined proxy: the splaro.co apex vhost is served from this
  # app too (hPanel maps it here) — api-only proxy turns the storefront into
  # Nest "Cannot GET /" 404s.
  cp "$REPO/infrastructure/hostinger/passenger-proxy-only.cjs" "$API_HTDOCS/nodejs/app.cjs"
  cat > "$API_HTDOCS/.htaccess" <<EOF
PassengerAppRoot ${USER_HOME}/domains/splaro.co/public_html/api/nodejs
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${USER_HOME}/domains/splaro.co/public_html/api/nodejs/tmp
RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.splaro\.co [NC]
RewriteRule ^ https://splaro.co%{REQUEST_URI} [R=301,L]
DirectoryIndex disabled
EOF
  touch "$API_HTDOCS/nodejs/tmp/restart.txt"
  log "api.splaro.co proxy configured"
fi

# Legacy domain folders (if hPanel ever creates separate sites)
if [ -d "$HOME/domains/admin.splaro.co/nodejs" ]; then
  cp "$REPO/infrastructure/hostinger/passenger-admin-proxy.cjs" "$HOME/domains/admin.splaro.co/nodejs/app.cjs"
  touch "$HOME/domains/admin.splaro.co/nodejs/tmp/restart.txt" 2>/dev/null || true
fi
if [ -d "$HOME/domains/api.splaro.co/nodejs" ]; then
  cp "$REPO/infrastructure/hostinger/passenger-api-proxy.cjs" "$HOME/domains/api.splaro.co/nodejs/app.cjs"
  touch "$HOME/domains/api.splaro.co/nodejs/tmp/restart.txt" 2>/dev/null || true
fi

curl -sf -m 10 "http://127.0.0.1:3001/" >/dev/null && log "web OK" || log "web DOWN"
curl -sf -m 10 "http://127.0.0.1:4000/api/v1/health" >/dev/null && log "api OK" || log "api DOWN"
curl -sf -m 10 "http://127.0.0.1:3002/login" >/dev/null && log "admin OK" || log "admin DOWN"
