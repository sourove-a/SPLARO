#!/bin/bash
# hPanel → Advanced → SSH Terminal — paste and run after git pull
# Full splaro.co + admin.splaro.co recovery
set -euo pipefail
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/pgenv/bin:$HOME/pgsql/pgsql/bin:$HOME/miniconda3/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
NODEJS="$HOME/domains/splaro.co/nodejs"
cd "$REPO"
git pull origin main

# .env — set DATABASE_URL in hPanel Environment if using Neon Postgres
if [ ! -f .env ]; then
  bash infrastructure/hostinger/generate-production-env.sh > .env
fi
upsert() { k="${1%%=*}"; grep -q "^${k}=" .env 2>/dev/null && sed -i "s|^${k}=.*|${1}|" .env || echo "$1" >> .env; }
upsert "NODE_ENV=production"
upsert "NEXT_PUBLIC_SITE_URL=https://splaro.co"
upsert "NEXT_PUBLIC_API_URL=https://splaro.co/api/v1"
upsert "NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co"
upsert "API_URL=https://splaro.co"
upsert "WEB_URL=https://splaro.co"
upsert "ADMIN_URL=https://admin.splaro.co"
upsert "CORS_ORIGINS=https://splaro.co,https://admin.splaro.co"
upsert "REDIS_ENABLED=false"
upsert "API_PORT=4000"
upsert "INTERNAL_WEB_PORT=3001"
chmod 600 .env

# PostgreSQL (local) — skip if using Neon DATABASE_URL in hPanel env
if [[ "${DATABASE_URL:-}" != *"neon.tech"* ]] && [[ "${DATABASE_URL:-}" != *"supabase.co"* ]]; then
  bash infrastructure/hostinger/setup-local-postgres.sh || echo "PG setup skipped — add Neon DATABASE_URL in hPanel"
fi

# Build web + admin + API on server
export SPLARO_HOSTINGER=1 SPLARO_BUILD_ADMIN=1 SPLARO_BUILD_API=1
export NODE_OPTIONS="--max-old-space-size=4096"
set -a && source .env && set +a
bash scripts/hostinger-build.sh

# Prisma migrate (needs working DATABASE_URL)
PRISMA="$REPO/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
if [ -f "$PRISMA" ] && [ -n "${DATABASE_URL:-}" ]; then
  node "$PRISMA" db push --schema=packages/database/prisma/schema.prisma || true
  node "$PRISMA" db seed --schema=packages/database/prisma/schema.prisma 2>/dev/null || true
fi

# Passenger + remove Hostinger default page
bash infrastructure/hostinger/activate-hostinger-site.sh
bash infrastructure/hostinger/install-passenger-proxies.sh 2>&1 | tail -5 || true
SPLARO_SKIP_SERVICE_FORK=1 bash infrastructure/hostinger/splaro-start-services.sh 2>&1 | tail -10 || true
[ -d "$HOME/domains/admin.splaro.co" ] && bash infrastructure/hostinger/setup-passenger-admin.sh || echo "Create admin.splaro.co subdomain in hPanel"
[ -d "$HOME/domains/api.splaro.co" ] && bash infrastructure/hostinger/setup-passenger-api.sh || echo "Create api.splaro.co subdomain in hPanel"
bash infrastructure/hostinger/patch-earth-textures.sh 2>/dev/null || true

sleep 20
echo "=== Health ==="
curl -sf http://127.0.0.1:4000/api/v1/health && echo || echo "api-local: down"
curl -s -o /dev/null -w "web:%{http_code} " https://splaro.co/
curl -s -o /dev/null -w "admin:%{http_code} " https://admin.splaro.co/login
curl -s -o /dev/null -w "api:%{http_code}\n" https://api.splaro.co/api/v1/health 2>/dev/null || true
