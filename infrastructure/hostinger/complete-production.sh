#!/bin/bash
# SPLARO full production orchestrator — Hostinger shared hosting
# Memory-safe: one service at a time, proxy-only Passenger, next start (not standalone server.js)
set +e
export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
NODEJS="$HOME/domains/splaro.co/nodejs"
ADMIN_HTDOCS="$HOME/domains/splaro.co/public_html/admin"
API_HTDOCS="$HOME/domains/splaro.co/public_html/api"
WEB_STANDALONE="$REPO/apps/web/.next/standalone/apps/web"
ADMIN_STANDALONE="$REPO/apps/admin/.next/standalone/apps/admin"
WEB_UPLOAD="$HOME/splaro-web-full/web-standalone/apps/web"
ADMIN_UPLOAD="$HOME/splaro-admin-full/admin-standalone/apps/admin"
WEB_UPLOAD_ST="$HOME/splaro-web-full/web-standalone"
ADMIN_UPLOAD_ST="$HOME/splaro-admin-full/admin-standalone"
NEXT_BIN=$(find "$REPO/node_modules" -path '*/next/dist/bin/next' 2>/dev/null | head -1)
USER_HOME="${HOME:-/home/u134578371}"

log() { echo "[complete-prod $(date '+%H:%M:%S')] $*"; }
upsert() {
  k="${1%%=*}"
  grep -q "^${k}=" "$REPO/.env" 2>/dev/null && sed -i "s|^${k}=.*|${1}|" "$REPO/.env" || echo "$1" >> "$REPO/.env"
}

cd "$REPO" || { log "ERROR: repo missing at $REPO"; exit 1; }
git pull origin main 2>/dev/null || true

# ── .env ──
if [ ! -f .env ]; then
  bash infrastructure/hostinger/generate-production-env.sh > .env
  log "Generated new .env"
fi
upsert "NODE_ENV=production"
upsert "NEXT_PUBLIC_SITE_URL=https://splaro.co"
upsert "NEXT_PUBLIC_API_URL=https://splaro.co/api/v1"
upsert "NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co"
upsert "NEXT_PUBLIC_CDN_URL=https://splaro.co"
upsert "NEXT_PUBLIC_STORE_ID=splaro"
upsert "WEB_URL=https://splaro.co"
upsert "ADMIN_URL=https://admin.splaro.co"
upsert "API_URL=https://api.splaro.co"
upsert "CORS_ORIGINS=https://splaro.co,https://admin.splaro.co"
upsert "REDIS_ENABLED=false"
upsert "API_PORT=4000"
upsert "INTERNAL_WEB_PORT=3001"
upsert "ADMIN_PORT=3002"
upsert "PORT=3000"
upsert "PAYMENT_DEV_STUB=false"
bash "$REPO/infrastructure/hostinger/apply-hostinger-mysql-env.sh" 2>/dev/null || true
chmod 600 .env
set -a && source .env && set +a

# ── Prisma binary target for Linux ──
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$SCHEMA" ] && ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
fi

# ── Earth textures ──
bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true

# ── Database FIRST (before API start) ──
log "Setting up PostgreSQL..."
bash "$REPO/infrastructure/hostinger/setup-local-postgres.sh" 2>&1 | tail -15 || \
  log "WARN: PostgreSQL setup failed — check ~/pgsql/postgres.log"
set -a && source .env && set +a

# ── Build API if missing ──
if [ ! -f "$REPO/apps/api/dist/main.js" ]; then
  log "Building API..."
  pnpm install --filter @splaro/api... --filter @splaro/database... --no-frozen-lockfile 2>&1 | tail -6
  pnpm --filter @splaro/api run build 2>&1 | tail -5
fi

# ── Kill stale processes (staggered) ──
log "Stopping stale processes..."
pkill -f "next/dist/bin/next start" 2>/dev/null || true
sleep 3
pkill -f "apps/api/dist/main.js" 2>/dev/null || true
sleep 3

# ── Sync .next from standalone for next start ──
if [ -d "$WEB_STANDALONE/.next" ]; then
  mkdir -p "$REPO/apps/web/.next"
  rsync -a "$WEB_STANDALONE/.next/" "$REPO/apps/web/.next/" 2>/dev/null || true
fi
if [ -d "$ADMIN_STANDALONE/.next" ]; then
  mkdir -p "$REPO/apps/admin/.next"
  rsync -a "$ADMIN_STANDALONE/.next/" "$REPO/apps/admin/.next/" 2>/dev/null || true
fi

# ── Start web (:3001) ──
if [ -n "$NEXT_BIN" ] && [ -d "$REPO/apps/web/.next" ]; then
  log "Starting web on :3001 (next start)..."
  cd "$REPO/apps/web"
  PORT=3001 HOSTNAME=127.0.0.1 nohup node "$NEXT_BIN" start >> "$NODEJS/web.log" 2>&1 &
  sleep 10
  curl -sf -m 8 "http://127.0.0.1:3001/" >/dev/null && log "web :3001 OK" || log "web :3001 DOWN"
elif [ -f "$WEB_UPLOAD/server.js" ]; then
  log "Starting web on :3001 (uploaded standalone)..."
  pkill -f "splaro-web-full.*server.js" 2>/dev/null || true
  sleep 2
  cd "$WEB_UPLOAD"
  PORT=3001 HOSTNAME=127.0.0.1 NODE_PATH="$WEB_UPLOAD_ST/node_modules:$WEB_UPLOAD/node_modules:$REPO/node_modules" \
    nohup node server.js >> "$NODEJS/web.log" 2>&1 &
  sleep 10
  curl -sf -m 8 "http://127.0.0.1:3001/" >/dev/null && log "web :3001 OK" || log "web :3001 DOWN"
else
  log "WARN: web build missing — upload Mac build or run hostinger-build.sh"
fi

# ── Start API (:4000) ──
if [ -f "$REPO/apps/api/dist/main.js" ]; then
  log "Starting API on :4000..."
  cd "$REPO/apps/api"
  API_PORT=4000 nohup node dist/main.js >> "$NODEJS/api.log" 2>&1 &
  sleep 10
  curl -sf -m 8 "http://127.0.0.1:4000/api/v1/health" >/dev/null && log "api :4000 OK" || log "api :4000 DOWN"
else
  log "WARN: API dist missing — run pnpm --filter @splaro/api run build"
fi

# ── Start admin (:3002) ──
if [ -n "$NEXT_BIN" ] && [ -d "$REPO/apps/admin/.next" ]; then
  log "Starting admin on :3002 (next start)..."
  mkdir -p "$ADMIN_HTDOCS/nodejs"
  cd "$REPO/apps/admin"
  PORT=3002 HOSTNAME=127.0.0.1 nohup node "$NEXT_BIN" start >> "$ADMIN_HTDOCS/nodejs/admin.log" 2>&1 &
  sleep 10
  curl -sf -m 8 "http://127.0.0.1:3002/login" >/dev/null && log "admin :3002 OK" || log "admin :3002 DOWN"
elif [ -f "$ADMIN_UPLOAD/server.js" ]; then
  log "Starting admin on :3002 (uploaded standalone)..."
  pkill -f "splaro-admin-full.*server.js" 2>/dev/null || true
  sleep 2
  mkdir -p "$ADMIN_HTDOCS/nodejs"
  cd "$ADMIN_UPLOAD"
  PORT=3002 HOSTNAME=127.0.0.1 NODE_PATH="$ADMIN_UPLOAD_ST/node_modules:$ADMIN_UPLOAD/node_modules:$REPO/node_modules" \
    nohup node server.js >> "$ADMIN_HTDOCS/nodejs/admin.log" 2>&1 &
  sleep 10
  curl -sf -m 8 "http://127.0.0.1:3002/login" >/dev/null && log "admin :3002 OK" || log "admin :3002 DOWN"
fi

# ── Passenger: splaro.co (proxy-only) ──
mkdir -p "$NODEJS/tmp"
cp "$REPO/infrastructure/hostinger/passenger-proxy-only.cjs" "$NODEJS/app.cjs"
cat > "$HOME/domains/splaro.co/public_html/.htaccess" <<EOF
PassengerAppRoot $NODEJS
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir $NODEJS/tmp
RewriteRule ^\.builds - [F,L]
DirectoryIndex disabled
EOF
touch "$NODEJS/tmp/restart.txt"
log "splaro.co Passenger proxy configured"

# ── Passenger: admin.splaro.co (public_html/admin) ──
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
rm -f "$ADMIN_HTDOCS/default.php"
touch "$ADMIN_HTDOCS/nodejs/tmp/restart.txt"
log "admin.splaro.co Passenger configured"

# ── Passenger: api.splaro.co (public_html/api) ──
mkdir -p "$API_HTDOCS/nodejs/tmp"
cp "$REPO/infrastructure/hostinger/passenger-api-proxy.cjs" "$API_HTDOCS/nodejs/app.cjs"
cat > "$API_HTDOCS/.htaccess" <<EOF
PassengerAppRoot ${USER_HOME}/domains/splaro.co/public_html/api/nodejs
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${USER_HOME}/domains/splaro.co/public_html/api/nodejs/tmp
DirectoryIndex disabled
EOF
rm -f "$API_HTDOCS/default.php"
touch "$API_HTDOCS/nodejs/tmp/restart.txt"
log "api.splaro.co Passenger configured"

sleep 15
log "=== Running verification ==="
bash "$REPO/infrastructure/hostinger/verify-production.sh" || true
log "=== complete-production.sh DONE ==="
