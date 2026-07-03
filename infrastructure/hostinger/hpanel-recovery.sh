#!/bin/bash
# Paste this in hPanel → Advanced → SSH Terminal (when SSH from Mac fails)
# Recovers splaro.co after Mac upload or Git pull
set -euo pipefail
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/pgenv/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
cd "$REPO"
git pull origin main

upsert() { k="${1%%=*}"; grep -q "^${k}=" .env 2>/dev/null && sed -i "s|^${k}=.*|${1}|" .env || echo "$1" >> .env; }
upsert "DATABASE_URL=postgresql://splaro_user:IRoiC9VlqPGRrW4dud1t@127.0.0.1:5433/splaro_db"
upsert "NEXT_PUBLIC_SITE_URL=https://splaro.co"
upsert "NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1"
upsert "NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co"
upsert "API_URL=https://api.splaro.co"
upsert "REDIS_ENABLED=false"
chmod 600 .env

$HOME/pgenv/bin/pg_ctl -D $HOME/pgsql/data -l $HOME/pgsql/postgres.log -o "-p 5433" start 2>/dev/null || true

# Build on server (skip if Mac upload already placed artifacts)
if [ ! -f apps/web/.next/standalone/apps/web/server.js ]; then
  echo "Building web+admin+api on server..."
  SPLARO_HOSTINGER=1 NODE_OPTIONS="--max-old-space-size=4096" bash scripts/hostinger-build.sh
  SPLARO_BUILD_ADMIN=1 SPLARO_HOSTINGER=1 bash scripts/hostinger-build.sh
  pnpm --filter @splaro/api run build
  node scripts/prepare-next-standalone.mjs apps/admin
fi

cp infrastructure/hostinger/passenger-stack-app.cjs $HOME/domains/splaro.co/nodejs/app.cjs
touch $HOME/domains/splaro.co/nodejs/tmp/restart.txt
bash infrastructure/hostinger/setup-passenger-admin.sh
[ -d "$HOME/domains/api.splaro.co" ] && bash infrastructure/hostinger/setup-passenger-api.sh || echo "Create api.splaro.co subdomain in hPanel first"
bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true

sleep 20
curl -s https://splaro.co/api/v1/health
echo
curl -s -o /dev/null -w "web:%{http_code} admin:%{http_code} api:%{http_code}\n" https://splaro.co/ https://admin.splaro.co/login https://api.splaro.co/api/v1/health
