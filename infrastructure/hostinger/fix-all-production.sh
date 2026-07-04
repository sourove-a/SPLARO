#!/bin/bash
# Full splaro.co recovery: PostgreSQL + Prisma + API + Next.js web + earth textures
set -euo pipefail

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
NODEJS_DIR="${SPLARO_NODEJS_DIR:-$HOME/domains/splaro.co/nodejs}"
export PATH="$HOME/pgenv/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"

log() { echo "[fix-all $(date '+%H:%M:%S')] $*"; }

# ── 1. PostgreSQL ──
PGDATA="$HOME/pgsql/data"
if [ -x "$HOME/pgenv/bin/pg_ctl" ] && [ -d "$PGDATA" ]; then
  if ! pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
    log "Starting PostgreSQL :5433"
    pg_ctl -D "$PGDATA" -l "$HOME/pgsql/postgres.log" -o "-p 5433" start || true
    sleep 3
  fi
  log "PostgreSQL: $(pg_isready -h 127.0.0.1 -p 5433 2>&1 || echo down)"
fi

cd "$REPO"

# ── 2. .env production URLs + redis off ──
if [ -f .env ]; then
  grep -v '^REDIS_ENABLED=' .env > .env.tmp || true
  mv .env.tmp .env
  for line in \
    'REDIS_ENABLED=false' \
    'NEXT_PUBLIC_SITE_URL=https://splaro.co' \
    'NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1' \
    'NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co' \
    'WEB_URL=https://splaro.co' \
    'API_URL=https://api.splaro.co' \
    'CORS_ORIGINS=https://splaro.co,https://admin.splaro.co' \
    'API_PORT=4000' \
    'INTERNAL_WEB_PORT=3001' \
    'PORT=3000'
  do
    key="${line%%=*}"
    grep -q "^${key}=" .env 2>/dev/null && sed -i "s|^${key}=.*|${line}|" .env || echo "$line" >> .env
  done
  chmod 600 .env
  set -a && source .env && set +a
fi

# ── 3. Prisma OpenSSL 3 binary (shared hosting) ──
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$SCHEMA" ] && ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
fi
log "Prisma generate..."
pnpm db:generate 2>&1 | tail -5 || true

# ── 4. API build if missing ──
if [ ! -f apps/api/dist/main.js ]; then
  log "Building API..."
  pnpm --filter @splaro/types run build 2>/dev/null || true
  cd apps/api && npx tsc -p tsconfig.json --skipLibCheck 2>/dev/null || pnpm run build
  cd "$REPO"
fi

# ── 5. Earth textures (self-hosted) ──
EARTH="$REPO/apps/web/public/images/earth"
HTDOCS="$HOME/domains/splaro.co/public_html/images/earth"
mkdir -p "$EARTH" "$HTDOCS"
if [ ! -f "$EARTH/earth-day.jpg" ]; then
  curl -fsSL -o "$EARTH/earth-day.jpg" "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg" || true
  curl -fsSL -o "$EARTH/earth-night.jpg" "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg" || true
  curl -fsSL -o "$EARTH/earth-bump.png" "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png" || true
  curl -fsSL -o "$EARTH/earth-clouds.png" "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/clouds/clouds.png" || true
  curl -fsSL -o "$EARTH/moon.jpg" "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r149/examples/textures/planets/moon_1024.jpg" || true
fi
cp -a "$EARTH"/* "$HTDOCS"/ 2>/dev/null || true
STANDALONE_PUB="$REPO/apps/web/.next/standalone/apps/web/public/images/earth"
mkdir -p "$STANDALONE_PUB" && cp -a "$EARTH"/* "$STANDALONE_PUB"/ 2>/dev/null || true

bash "$REPO/infrastructure/hostinger/patch-earth-textures.sh" 2>/dev/null || true

# ── 6. Patch API URLs in bundles ──
for dir in \
  "apps/web/.next/static" \
  "apps/web/.next/server" \
  "apps/web/.next/standalone/apps/web/.next/static" \
  "apps/web/.next/standalone/apps/web/.next/server"
do
  [ -d "$dir" ] || continue
  find "$dir" -name '*.js' -type f 2>/dev/null | while read -r f; do
    sed -i \
      -e 's|https://api.splaro.co/api/v1|https://splaro.co/api/v1|g' \
      -e 's|https://api.splaro.co|https://splaro.co|g' \
      -e 's|http://127.0.0.1:3000|https://splaro.co|g' \
      -e 's|http://localhost:3000|https://splaro.co|g' \
      "$f" 2>/dev/null || true
  done
done

# ── 7. Fix standalone web permissions ──
find "$REPO/node_modules" -type f \( -path '*/.bin/*' -o -path '*/next/dist/bin/next' \) -exec chmod +x {} \; 2>/dev/null || true
WEB_SERVER="$REPO/apps/web/.next/standalone/apps/web/server.js"
if [ ! -f "$WEB_SERVER" ]; then
  log "ERROR: Web standalone missing — run build on Mac/Linux and upload"
else
  log "Web standalone OK: $WEB_SERVER"
fi

# ── 8. Passenger stack ──
mkdir -p "$NODEJS_DIR/tmp"
cp "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" "$NODEJS_DIR/app.cjs"
touch "$NODEJS_DIR/tmp/restart.txt"

log "Waiting for stack..."
sleep 15

API_LOCAL="$(curl -s -m 15 -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health 2>/dev/null || echo 000)"
WEB_LOCAL="$(curl -s -m 15 -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ 2>/dev/null || echo 000)"
PROXY_HOME="$(curl -s -m 20 -o /dev/null -w '%{http_code}' https://splaro.co/ 2>/dev/null || echo 000)"
PROXY_API="$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://splaro.co/api/v1/health 2>/dev/null || echo 000)"
PRODUCTS="$(curl -s -m 20 'http://127.0.0.1:4000/api/v1/storefront/products?storeId=splaro' 2>/dev/null | head -c 200 || echo timeout)"

log "API local:$API_LOCAL web local:$WEB_LOCAL home:$PROXY_HOME api proxy:$PROXY_API"
log "Products: $PRODUCTS"
tail -15 "$NODEJS_DIR/stderr.log" 2>/dev/null || true
