#!/bin/bash
# Write/update repo .env from hPanel Environment Variables (Git deploy injects these).
# Run during npm run build on Hostinger — no manual SSH needed.
set -euo pipefail

REPO="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
ENV_FILE="$REPO/.env"

upsert() {
  local key="${1%%=*}"
  local val="${1#*=}"
  [ -n "$val" ] || return 0
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

# Start fresh template if missing
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://splaro.co
NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co
NEXT_PUBLIC_API_URL=https://splaro.co/api/v1
NEXT_PUBLIC_CDN_URL=https://splaro.co
WEB_URL=https://splaro.co
ADMIN_URL=https://admin.splaro.co
API_URL=https://splaro.co
INTERNAL_API_URL=http://127.0.0.1:4000/api/v1
SPLARO_HOSTINGER=1
CORS_ORIGINS=https://splaro.co,https://www.splaro.co,https://admin.splaro.co
NEXT_PUBLIC_STORE_ID=splaro
REDIS_ENABLED=false
API_PORT=4000
INTERNAL_WEB_PORT=3001
ADMIN_PORT=3002
PAYMENT_DEV_STUB=false
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=u134578371_SPLARO
MYSQL_USER=u134578371_splaro
ADMIN_EMAIL=splaro.bd@gmail.com
NEXT_PUBLIC_ADMIN_EMAIL=splaro.bd@gmail.com
EOF
  chmod 600 "$ENV_FILE"
fi

# hPanel → Environment variables (paste DATABASE_URL, TELEGRAM, JWT, etc.)
for key in \
  DATABASE_URL DATABASE_URL_SHADOW \
  TELEGRAM_BOT_TOKEN TELEGRAM_ADMIN_USER_ID TELEGRAM_STORE_SLUG \
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME \
  JWT_SECRET JWT_REFRESH_SECRET ADMIN_SESSION_SECRET ENCRYPTION_KEY \
  REVALIDATE_SECRET INTERNAL_HEALTH_SECRET \
  ADMIN_EMAIL NEXT_PUBLIC_ADMIN_EMAIL ADMIN_PASSWORD \
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_DEFAULT_SPREADSHEET_ID \
  GOOGLE_SERVICE_ACCOUNT_EMAIL GOOGLE_SERVICE_ACCOUNT_KEY_PATH \
  ANTHROPIC_API_KEY GEMINI_API_KEY OPENAI_API_KEY \
  STEADFAST_API_KEY STEADFAST_SECRET_KEY \
  BKASH_APP_KEY BKASH_APP_SECRET BKASH_USERNAME BKASH_PASSWORD \
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
  MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_PHPMYADMIN_URL
do
  val="${!key:-}"
  [ -n "$val" ] && upsert "${key}=${val}"
done

echo "[sync-hpanel-env] .env synced ($(wc -l < "$ENV_FILE") lines)"
