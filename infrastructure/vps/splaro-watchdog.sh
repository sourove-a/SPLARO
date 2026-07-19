#!/bin/bash
# SPLARO VPS watchdog — restart dead PM2 apps. Cron: */5 * * * * + @reboot
#
# Install:
#   sudo cp infrastructure/vps/splaro-watchdog.sh /usr/local/bin/splaro-watchdog
#   sudo chmod +x /usr/local/bin/splaro-watchdog
#   (crontab -l; echo '*/5 * * * * /usr/local/bin/splaro-watchdog') | crontab -

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
LOG_DIR="${SPLARO_LOG_DIR:-/var/log/splaro}"
LOG_FILE="${LOG_DIR}/watchdog.log"
LOCK_FILE="/var/run/splaro-watchdog.lock"
PM2_CONFIG="${APP_DIR}/infrastructure/pm2/ecosystem.config.js"

mkdir -p "$LOG_DIR"
log() { echo "[watchdog $(date '+%F %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

telegram_alert() {
  local message=$1
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || return 0
  [ -n "${TELEGRAM_ADMIN_USER_ID:-}" ] || return 0
  curl -sf -m 8 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_ADMIN_USER_ID}" \
    --data-urlencode "text=${message}" >/dev/null 2>&1 || true
}

ensure_service() {
  local service=$1
  local label=$2
  if systemctl is-active --quiet "$service"; then return 0; fi
  log "$label down — restarting $service"
  systemctl restart "$service" >>"$LOG_FILE" 2>&1 || true
  if systemctl is-active --quiet "$service"; then
    log "$label recovered"
    telegram_alert "✅ SPLARO watchdog recovered ${label} on $(hostname)"
    return 0
  fi
  log "WARN: $label still down"
  telegram_alert "🚨 SPLARO watchdog could not recover ${label} on $(hostname)"
  return 1
}

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

if [ -f "$APP_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a && source "$APP_DIR/.env" && set +a
fi

ensure_service postgresql@16-main.service PostgreSQL || true
ensure_service redis-server.service Redis || true
ensure_service meilisearch.service Meilisearch || true
ensure_service nginx.service Nginx || true

api_ok() {
  curl -sf -m 8 http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1
}

web_ok() {
  curl -sf -m 8 -o /dev/null http://127.0.0.1:3000/ 2>/dev/null
}

admin_ok() {
  curl -sf -m 8 -o /dev/null http://127.0.0.1:3001/login 2>/dev/null
}

reload_pm2() {
  log "PM2 reload — health probe failed"
  pm2 startOrReload "$PM2_CONFIG" --update-env 2>>"$LOG_FILE" || pm2 resurrect 2>>"$LOG_FILE" || true
  pm2 save 2>>"$LOG_FILE" || true
}

if ! api_ok || ! web_ok; then
  reload_pm2
  sleep 8
fi

if ! api_ok; then
  log "WARN: API still down after reload"
  telegram_alert "🚨 SPLARO API still down after watchdog reload on $(hostname)"
else
  log "API healthy"
fi

if ! web_ok; then
  log "WARN: web still down after reload"
  telegram_alert "🚨 SPLARO web still down after watchdog reload on $(hostname)"
else
  log "web healthy"
fi

if ! admin_ok; then
  log "WARN: admin not responding on :3001"
  telegram_alert "🚨 SPLARO admin not responding on $(hostname)"
fi
