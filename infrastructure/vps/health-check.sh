#!/bin/bash
# SPLARO VPS — post-deploy health + integration gap report
# Usage: bash infrastructure/vps/health-check.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
ENV_FILE="$APP_DIR/.env"

pass() { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
fail() { echo "  ❌ $*"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  SPLARO Production Health Check                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Services
echo "📡 Services"
pm2 jlist 2>/dev/null | python3 -c "
import json,sys
apps=json.load(sys.stdin)
for a in apps:
    s=a.get('pm2_env',{}).get('status','?')
    icon='✅' if s=='online' else '❌'
    print(f'  {icon} {a[\"name\"]} — {s}')
" 2>/dev/null || pm2 list

WEB=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)
ADM=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login || echo 000)
API=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health || echo 000)
[ "$WEB" = "200" ] && pass "web :3000 → $WEB" || fail "web :3000 → $WEB"
[ "$ADM" = "200" ] && pass "admin :3001 → $ADM" || warn "admin :3001 → $ADM"
[ "$API" = "200" ] && pass "api :4000 → $API" || fail "api :4000 → $API"

echo ""
echo "🗄️  Data"
redis-cli ping >/dev/null 2>&1 && pass "Redis PONG" || fail "Redis down"
sudo -u postgres psql -d splaro_db -t -c 'SELECT count(*) FROM "Product"' 2>/dev/null | xargs -I{} pass "Products: {}" || warn "DB query failed"

echo ""
echo "🔑 Integrations (.env)"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  check_key() {
    local k=$1
    local v="${!k:-}"
    if [ -z "$v" ]; then warn "$k — not set"
    else pass "$k — configured"
    fi
  }
  check_key BKASH_APP_KEY
  check_key SSLCOMMERZ_STORE_ID
  check_key STEADFAST_API_KEY
  check_key R2_BUCKET_NAME
  check_key OPENAI_API_KEY
  check_key TELEGRAM_BOT_TOKEN
  check_key META_PIXEL_ID
else
  fail "Missing $ENV_FILE"
fi

echo ""
echo "🌐 Public"
curl -s -o /dev/null -w '' https://splaro.co/ && pass "https://splaro.co" || fail "https://splaro.co"
curl -s -o /dev/null -w '' https://api.splaro.co/api/v1/health && pass "https://api.splaro.co" || fail "https://api.splaro.co"

echo ""
echo "Done."
