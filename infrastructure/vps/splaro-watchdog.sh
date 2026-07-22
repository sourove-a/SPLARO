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
DEPLOY_LOCK="${SPLARO_DEPLOY_LOCK:-/var/run/splaro-deploy.lock}"
PM2_CONFIG="${APP_DIR}/infrastructure/pm2/ecosystem.config.js"
# After a reload, Next/Nest often need >8s. Retry before Telegram spam.
HEALTH_RETRIES="${SPLARO_WATCHDOG_RETRIES:-8}"
HEALTH_SLEEP_SECS="${SPLARO_WATCHDOG_SLEEP_SECS:-5}"

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

deploy_in_progress() {
  # Explicit lock from deploy.sh
  if [ -f "$DEPLOY_LOCK" ]; then
    local age
    age=$(( $(date +%s) - $(stat -c %Y "$DEPLOY_LOCK" 2>/dev/null || echo 0) ))
    # Stale lock > 45m means a crashed deploy — allow watchdog to heal.
    if [ "$age" -lt 2700 ]; then
      return 0
    fi
    log "Stale deploy lock (${age}s) — ignoring"
    return 1
  fi
  # Fallback: deploy.log touched during a long build (lock missing on stale
  # /opt/splaro/deploy.sh copies). Builds routinely take 10–20 minutes.
  if [ -f "${LOG_DIR}/deploy.log" ]; then
    local dage
    dage=$(( $(date +%s) - $(stat -c %Y "${LOG_DIR}/deploy.log" 2>/dev/null || echo 0) ))
    if [ "$dage" -lt 1200 ]; then
      return 0
    fi
  fi
  # Mid-build: web/admin stopped for RAM — never alert/reload over that.
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 jlist 2>/dev/null | grep -Eq '"name":"splaro-(web|admin)".*"status":"stopped"'; then
      return 0
    fi
  fi
  return 1
}

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

if [ -f "$APP_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a && source "$APP_DIR/.env" && set +a
fi

if deploy_in_progress; then
  log "Deploy in progress — skip health probes (no Telegram alert)"
  exit 0
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

wait_healthy() {
  local name=$1
  local fn=$2
  local i
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if "$fn"; then
      log "$name healthy (attempt $i/$HEALTH_RETRIES)"
      return 0
    fi
    sleep "$HEALTH_SLEEP_SECS"
  done
  return 1
}

reload_pm2() {
  log "PM2 reload — health probe failed"
  pm2 startOrReload "$PM2_CONFIG" --update-env 2>>"$LOG_FILE" || pm2 resurrect 2>>"$LOG_FILE" || true
  pm2 save 2>>"$LOG_FILE" || true
}

if ! api_ok || ! web_ok; then
  # Mid-deploy race: lock may appear between our check and probe.
  if deploy_in_progress; then
    log "Deploy started during probe — skip reload/alert"
    exit 0
  fi
  reload_pm2
fi

if ! wait_healthy API api_ok; then
  if deploy_in_progress; then
    log "WARN: API down but deploy active — no alert"
  else
    log "WARN: API still down after reload"
    telegram_alert "🚨 SPLARO API still down after watchdog reload on $(hostname)"
  fi
fi

if ! wait_healthy web web_ok; then
  if deploy_in_progress; then
    log "WARN: web down but deploy active — no alert"
  else
    log "WARN: web still down after reload"
    telegram_alert "🚨 SPLARO web still down after watchdog reload on $(hostname)"
  fi
fi

if deploy_in_progress; then
  : # already skipped at top; keep quiet if race appeared mid-run
elif admin_ok; then
  log "admin healthy (attempt 1/$HEALTH_RETRIES)"
else
  # Targeted heal before Telegram — full PM2 reload above may have raced a deploy.
  if [ -f "${APP_DIR}/apps/admin/.next/standalone/apps/admin/server.js" ]; then
    log "Admin down — restarting splaro-admin"
    pm2 restart splaro-admin --update-env 2>>"$LOG_FILE" || true
  fi
  if ! wait_healthy admin admin_ok; then
    if deploy_in_progress; then
      log "WARN: admin down but deploy active — no alert"
    else
      log "WARN: admin not responding on :3001"
      telegram_alert "🚨 SPLARO admin not responding on $(hostname)"
    fi
  fi
fi
