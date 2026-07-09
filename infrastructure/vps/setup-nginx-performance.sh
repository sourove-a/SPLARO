#!/bin/bash
# SPLARO VPS — Nginx gzip, rate-limit zones, http2 site configs, static cache headers.
# Idempotent — aborts reload if nginx -t fails (nothing breaks).
#
# Usage (on VPS as root):
#   bash /var/www/splaro/infrastructure/vps/setup-nginx-performance.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
PERF_SRC="$APP_DIR/infrastructure/vps/nginx-http-performance.conf"
PERF_DST="/etc/nginx/conf.d/splaro-performance.conf"

log() { echo "[nginx-perf $(date '+%H:%M:%S')] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
[ -d "$APP_DIR" ] || { echo "Missing $APP_DIR"; exit 1; }
command -v nginx >/dev/null || { echo "nginx not installed"; exit 1; }

has_rate_zones() {
  grep -rq 'limit_req_zone.*zone=general' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null
}

install_perf_snippet() {
  if has_rate_zones; then
    log "Rate-limit zones already defined — installing gzip-only snippet"
    awk '!/^limit_req_zone/' "$PERF_SRC" > "$PERF_DST"
  else
    log "Installing gzip + rate-limit zones"
    cp "$PERF_SRC" "$PERF_DST"
  fi
}

sync_site_configs() {
  # VPS uses unified splaro.co.conf (web + admin + api server blocks).
  # Copying hostinger per-host configs alongside it duplicates http-level
  # directives and server_name blocks → nginx -t fails → 502 for everyone.
  if [ -f /etc/nginx/sites-enabled/splaro.co.conf ] || [ -f /etc/nginx/sites-available/splaro.co.conf ]; then
    log "splaro.co.conf present — skip hostinger per-host site sync"
    rm -f /etc/nginx/sites-enabled/splaro-web.conf \
      /etc/nginx/sites-enabled/splaro-admin.conf \
      /etc/nginx/sites-enabled/splaro-api.conf 2>/dev/null || true
    return 0
  fi

  local web="$APP_DIR/infrastructure/hostinger/splaro-co-web.conf"
  local admin="$APP_DIR/infrastructure/hostinger/splaro-co-admin.conf"
  local api="$APP_DIR/infrastructure/hostinger/splaro-co-api.conf"

  for f in "$web" "$admin" "$api"; do
    [ -f "$f" ] || { log "WARN: missing $f — skip site sync"; return 0; }
  done

  if [ ! -d "/etc/letsencrypt/live/splaro.co" ]; then
    log "No SSL cert yet — skip HTTPS site sync (use go-live / certbot first)"
    return 0
  fi

  log "Syncing splaro-co-*.conf → sites-available"
  cp "$web" /etc/nginx/sites-available/splaro-web.conf
  cp "$admin" /etc/nginx/sites-available/splaro-admin.conf
  cp "$api" /etc/nginx/sites-available/splaro-api.conf
  ln -sf /etc/nginx/sites-available/splaro-web.conf /etc/nginx/sites-enabled/splaro-web.conf
  ln -sf /etc/nginx/sites-available/splaro-admin.conf /etc/nginx/sites-enabled/splaro-admin.conf
  ln -sf /etc/nginx/sites-available/splaro-api.conf /etc/nginx/sites-enabled/splaro-api.conf
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
}

log "Starting nginx performance setup..."
install_perf_snippet
sync_site_configs

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  log "Nginx reloaded OK (gzip + http2 site configs)"
else
  log "ERROR: nginx -t failed — reverting performance snippet"
  rm -f "$PERF_DST"
  nginx -t
  exit 1
fi
