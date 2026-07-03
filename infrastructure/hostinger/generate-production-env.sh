#!/bin/bash
# Generate production .env for splaro.co with random secrets.
# Usage: bash infrastructure/hostinger/generate-production-env.sh > /tmp/splaro-prod.env

set -euo pipefail

rand() { openssl rand -base64 "$1" | tr -d '/+=' | head -c "$1"; }

DB_PASS="${SPLARO_DB_PASS:-$(rand 24)}"
JWT="$(rand 48)"
REFRESH="$(rand 48)"
ADMIN_SESS="$(rand 32)"
REVAL="$(rand 24)"
HEALTH="$(rand 24)"
ENC="$(rand 32)"
ADMIN_PASS="$(rand 16)"

DB_URL="${DATABASE_URL:-postgresql://splaro_user:${DB_PASS}@127.0.0.1:5432/splaro_db}"
DB_SHADOW="${DATABASE_URL_SHADOW:-postgresql://splaro_user:${DB_PASS}@127.0.0.1:5432/splaro_shadow_db}"

cat <<EOF
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://splaro.co
NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co
NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1
NEXT_PUBLIC_CDN_URL=https://splaro.co
WEB_URL=https://splaro.co
ADMIN_URL=https://admin.splaro.co
API_URL=https://api.splaro.co
CORS_ORIGINS=https://splaro.co,https://admin.splaro.co
NEXTAUTH_URL=https://splaro.co
NEXT_PUBLIC_STORE_ID=splaro
NEXT_PUBLIC_ADMIN_EMAIL=splaro.bd@gmail.com
ADMIN_EMAIL=splaro.bd@gmail.com
JWT_SECRET=${JWT}
JWT_REFRESH_SECRET=${REFRESH}
ADMIN_SESSION_SECRET=${ADMIN_SESS}
REVALIDATE_SECRET=${REVAL}
INTERNAL_HEALTH_SECRET=${HEALTH}
ENCRYPTION_KEY=${ENC}
DATABASE_URL=${DB_URL}
DATABASE_URL_SHADOW=${DB_SHADOW}
REDIS_URL=redis://127.0.0.1:6379
REDIS_ENABLED=true
API_PORT=4000
PORT_WEB=3000
PORT_ADMIN=3001
PAYMENT_DEV_STUB=false
NEXT_PUBLIC_MAINTENANCE_MODE=false
ADMIN_PASSWORD=${ADMIN_PASS}
EOF

echo "# DB password for postgres setup: ${DB_PASS}" >&2
echo "# Admin bootstrap password (change after first login): ${ADMIN_PASS}" >&2
