#!/bin/bash
# Create Hostinger MySQL database via API (for legacy PHP admin; SPLARO API needs PostgreSQL).
set -euo pipefail

TOKEN="${HOSTINGER_API_TOKEN:-$(cat "$HOME/.api_token" 2>/dev/null || true)}"
USER="${HOSTINGER_ACCOUNT:-u134578371}"
DOMAIN="${HOSTINGER_WEBSITE_DOMAIN:-splaro.co}"
DB_NAME="${MYSQL_DB_NAME:-splaro}"
DB_USER="${MYSQL_DB_USER:-splaro}"
DB_PASS="${MYSQL_DB_PASS:-$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)}"

die() { echo "ERROR: $*" >&2; exit 1; }
[ -n "$TOKEN" ] || die "Missing Hostinger API token at ~/.api_token"

BODY=$(printf '{"name":"%s","user":"%s","password":"%s","website_domain":"%s"}' \
  "$DB_NAME" "$DB_USER" "$DB_PASS" "$DOMAIN")

RESP=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "https://developers.hostinger.com/api/hosting/v1/accounts/${USER}/databases" \
  -d "$BODY")

echo "$RESP"
echo "MySQL password (save this): $DB_PASS"
