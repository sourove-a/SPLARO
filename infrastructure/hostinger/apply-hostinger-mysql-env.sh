#!/bin/bash
# Hostinger MySQL (hPanel / phpMyAdmin) → SPLARO server .env
# SPLARO API uses DATABASE_URL (PostgreSQL). MySQL vars are for phpMyAdmin / legacy tools only.
set -euo pipefail

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
[ -f "$REPO/pnpm-workspace.yaml" ] || REPO="$HOME/domains/splaro.co/nodejs"
ENV_FILE="${SPLARO_ENV_FILE:-$REPO/.env}"

MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_DATABASE="${MYSQL_DATABASE:-u134578371_SPLARO}"
MYSQL_USER="${MYSQL_USER:-u134578371_splaro}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
PHPMYADMIN_URL="${PHPMYADMIN_URL:-https://hpanel.hostinger.com/websites/splaro.co/databases/php-my-admin}"

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1" 2>/dev/null \
    || node -e "console.log(encodeURIComponent(process.argv[1]))" "$1"
}

log() { echo "[mysql-env $(date '+%H:%M:%S')] $*"; }
upsert() {
  local key="${1%%=*}" val="${1#*=}"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

[ -f "$ENV_FILE" ] || touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

ENC_PASS="$(urlencode "$MYSQL_PASSWORD")"
MYSQL_URL="mysql://${MYSQL_USER}:${ENC_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"

# Remove old flat keys if re-running
grep -v '^MYSQL_URL=' "$ENV_FILE" | grep -v '^MYSQL_HOST=' | grep -v '^MYSQL_PORT=' \
  | grep -v '^MYSQL_DATABASE=' | grep -v '^MYSQL_USER=' | grep -v '^MYSQL_PASSWORD=' \
  | grep -v '^MYSQL_PHPMYADMIN_URL=' | grep -v '^# ── HOSTINGER MYSQL' > "${ENV_FILE}.tmp" || true
mv "${ENV_FILE}.tmp" "$ENV_FILE"

cat >> "$ENV_FILE" <<EOF

# ── HOSTINGER MYSQL (phpMyAdmin — not SPLARO Prisma DATABASE_URL) ──
MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
MYSQL_DATABASE=${MYSQL_DATABASE}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD="${MYSQL_PASSWORD}"
MYSQL_URL=${MYSQL_URL}
MYSQL_PHPMYADMIN_URL=${PHPMYADMIN_URL}
EOF

chmod 600 "$ENV_FILE"
log "MySQL env written → $ENV_FILE"
log "  Database : ${MYSQL_DATABASE}"
log "  User     : ${MYSQL_USER}"
log "  phpMyAdmin: ${PHPMYADMIN_URL}"

if command -v mysql >/dev/null 2>&1; then
  if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1 AS ok;" "$MYSQL_DATABASE" 2>/dev/null | grep -q ok; then
    log "MySQL connection test: OK"
  else
    log "MySQL connection test: failed (check hPanel password or wait for server recovery)"
  fi
else
  log "mysql CLI not found — skip connection test (phpMyAdmin still works from hPanel)"
fi

log "Reminder: SPLARO orders/products use DATABASE_URL (PostgreSQL), not MYSQL_*"
