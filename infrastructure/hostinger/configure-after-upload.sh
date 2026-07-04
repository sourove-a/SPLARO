#!/bin/bash
# Configure server after Mac build upload — no rebuild needed
set -euo pipefail
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/pgenv/bin:$PATH"

REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
NODEJS="$HOME/domains/splaro.co/nodejs"
cd "$REPO"

log() { echo "[configure $(date '+%H:%M:%S')] $*"; }

# ── PostgreSQL ──
if [ ! -f "$HOME/pgsql/data/PG_VERSION" ]; then
  log "Setting up PostgreSQL..."
  bash infrastructure/hostinger/setup-local-postgres.sh || log "PG setup failed — will retry"
fi
$HOME/pgenv/bin/pg_ctl -D $HOME/pgsql/data -l $HOME/pgsql/postgres.log -o "-p 5433" start 2>/dev/null || true

# ── .env ──
if [ ! -f .env ]; then
  bash infrastructure/hostinger/generate-production-env.sh > .env
fi
upsert() { k="${1%%=*}"; grep -q "^${k}=" .env 2>/dev/null && sed -i "s|^${k}=.*|${1}|" .env || echo "$1" >> .env; }
upsert "NODE_ENV=production"
upsert "NEXT_PUBLIC_SITE_URL=https://splaro.co"
upsert "NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1"
upsert "NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co"
upsert "NEXT_PUBLIC_CDN_URL=https://splaro.co"
upsert "WEB_URL=https://splaro.co"
upsert "ADMIN_URL=https://admin.splaro.co"
upsert "API_URL=https://api.splaro.co"
upsert "CORS_ORIGINS=https://splaro.co,https://admin.splaro.co"
upsert "REDIS_ENABLED=false"
upsert "API_PORT=4000"
upsert "INTERNAL_WEB_PORT=3001"
upsert "PORT=3000"
upsert "NEXT_PUBLIC_STORE_ID=splaro"
upsert "PAYMENT_DEV_STUB=false"
chmod 600 .env

# ── Prisma (use npx if pnpm broken) ──
set -a && source .env && set +a
log "Prisma generate + migrate..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm db:generate 2>/dev/null || npx prisma generate --schema=packages/database/prisma/schema.prisma
  pnpm db:migrate:prod 2>/dev/null || pnpm db:push 2>/dev/null || npx prisma db push --schema=packages/database/prisma/schema.prisma
  pnpm db:seed 2>/dev/null || log "Seed skipped"
else
  cd packages/database && npx prisma generate && npx prisma db push && npx prisma db seed 2>/dev/null || log "Seed skipped"
  cd "$REPO"
fi

# ── Prisma OpenSSL 3 binary target ──
SCHEMA="$REPO/packages/database/prisma/schema.prisma"
if [ -f "$SCHEMA" ] && ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
  cd packages/database && npx prisma generate && cd "$REPO"
fi

# ── Earth textures ──
bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true

# ── Passenger stack (web + API on splaro.co) ──
log "Configuring Passenger stack..."
mkdir -p "$NODEJS/tmp"
cp infrastructure/hostinger/passenger-stack-app.cjs "$NODEJS/app.cjs"

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

# ── Admin subdomain (if exists) ──
if [ -d "$HOME/domains/admin.splaro.co" ]; then
  bash infrastructure/hostinger/setup-passenger-admin.sh || log "Admin passenger warning"
else
  log "NOTE: Create admin.splaro.co subdomain in hPanel → Websites → Subdomains"
fi

# ── API subdomain (if exists) ──
if [ -d "$HOME/domains/api.splaro.co" ]; then
  bash infrastructure/hostinger/setup-passenger-api.sh || log "API passenger warning"
else
  log "NOTE: Create api.splaro.co subdomain in hPanel for dedicated API"
fi

log "Waiting for stack..."
sleep 25

API_LOCAL=$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health 2>/dev/null || echo 000)
WEB_LOCAL=$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ 2>/dev/null || echo 000)
WEB_PUB=$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://splaro.co/ 2>/dev/null || echo 000)
API_PUB=$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://splaro.co/api/v1/health 2>/dev/null || echo 000)
ADMIN_PUB=$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://admin.splaro.co/login 2>/dev/null || echo 000)

log "Health — api-local:$API_LOCAL web-local:$WEB_LOCAL"
log "Public  — web:$WEB_PUB api-proxy:$API_PUB admin:$ADMIN_PUB"
tail -20 "$NODEJS/stderr.log" 2>/dev/null || true
