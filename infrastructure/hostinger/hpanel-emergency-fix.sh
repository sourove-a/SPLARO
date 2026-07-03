#!/bin/bash
# Paste this entire script in hPanel → Advanced → SSH Terminal (Browser Terminal)
# Fixes: Upstream unavailable, API DB, earth textures
set -euo pipefail

export PATH="$HOME/pgenv/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
NODEJS="$HOME/domains/splaro.co/nodejs"
STANDALONE="$REPO/apps/web/.next/standalone"
WEB="$STANDALONE/apps/web"

echo "=== 1. PostgreSQL ==="
if [ -x "$HOME/pgenv/bin/pg_ctl" ] && [ -d "$HOME/pgsql/data" ]; then
  pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null || \
    pg_ctl -D "$HOME/pgsql/data" -l "$HOME/pgsql/postgres.log" -o "-p 5433" start
  echo "PG: $(pg_isready -h 127.0.0.1 -p 5433 2>&1)"
fi

echo "=== 2. .env URLs ==="
cd "$REPO"
[ -f .env ] || { echo "Missing .env"; exit 1; }
grep -v '^REDIS_ENABLED=' .env > .env.tmp && mv .env.tmp .env
for line in \
  'REDIS_ENABLED=false' \
  'NEXT_PUBLIC_API_URL=https://splaro.co/api/v1' \
  'NEXT_PUBLIC_SITE_URL=https://splaro.co' \
  'API_PORT=4000' \
  'INTERNAL_WEB_PORT=3001'
do
  k="${line%%=*}"
  grep -q "^${k}=" .env && sed -i "s|^${k}=.*|${line}|" .env || echo "$line" >> .env
done

echo "=== 3. Prisma OpenSSL 3 ==="
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$SCHEMA" ] && ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
fi
set -a && source .env && set +a
pnpm db:generate 2>&1 | tail -3 || true

echo "=== 4. Earth textures ==="
EARTH="$REPO/apps/web/public/images/earth"
HTDOCS="$HOME/domains/splaro.co/public_html/images/earth"
mkdir -p "$EARTH" "$HTDOCS"
for pair in \
  "earth-day.jpg|https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg" \
  "earth-night.jpg|https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg" \
  "earth-bump.png|https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png" \
  "earth-clouds.png|https://raw.githubusercontent.com/vasturiano/three-globe/master/example/clouds/clouds.png" \
  "moon.jpg|https://cdn.jsdelivr.net/gh/mrdoob/three.js@r149/examples/textures/planets/moon_1024.jpg"
do
  f="${pair%%|*}"; u="${pair#*|}"
  [ -f "$EARTH/$f" ] || curl -fsSL -o "$EARTH/$f" "$u" || true
done
cp -a "$EARTH"/* "$HTDOCS"/ 2>/dev/null || true
if [ -f "$REPO/infrastructure/hostinger/patch-earth-textures.sh" ]; then
  bash "$REPO/infrastructure/hostinger/patch-earth-textures.sh" || true
fi

echo "=== 5. Start Next.js web (:3001) ==="
[ -f "$WEB/server.js" ] || { echo "ERROR: Web build missing at $WEB/server.js"; exit 2; }
pkill -f "$WEB/server.js" 2>/dev/null || true
sleep 1
cd "$WEB"
PORT=3001 HOSTNAME=127.0.0.1 \
  NODE_PATH="$STANDALONE/node_modules:$WEB/node_modules:$REPO/node_modules" \
  nohup node server.js >> "$NODEJS/web.log" 2>&1 &
sleep 5
echo "Web local: $(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ || echo fail)"

echo "=== 6. Passenger stack ==="
if [ -f "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" ]; then
  cp "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" "$NODEJS/app.cjs"
elif [ -f "$REPO/infrastructure/hostinger/fix-production.sh" ]; then
  bash "$REPO/infrastructure/hostinger/fix-production.sh" || true
fi
touch "$NODEJS/tmp/restart.txt"
sleep 12

echo "=== 7. Health check ==="
echo "API:  $(curl -s -m 15 https://splaro.co/api/v1/health | head -c 80)"
echo "Home: $(curl -s -m 20 -o /dev/null -w '%{http_code}' https://splaro.co/)"
echo "Products: $(curl -s -m 20 'https://splaro.co/api/v1/storefront/products?storeId=splaro' | head -c 120)"
echo "Done — hard refresh splaro.co (Ctrl+Shift+R)"
