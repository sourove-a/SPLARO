#!/bin/bash
# SPLARO VPS — Meilisearch (localhost:7700, not public).
# Idempotent — keeps existing master key; appends .env only when vars missing.
#
# Usage (on VPS as root):
#   bash /var/www/splaro/infrastructure/vps/setup-meilisearch.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
MEILI_BIN="/usr/local/bin/meilisearch"
MEILI_ENV="/etc/meilisearch/env"
MEILI_DATA="/var/lib/meilisearch/data"
MEILI_HOST="http://127.0.0.1:7700"

log() { echo "[meilisearch $(date '+%H:%M:%S')] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

rand_key() { openssl rand -hex 32; }

install_binary() {
  if [ -x "$MEILI_BIN" ]; then
    log "Meilisearch binary already installed"
    return
  fi

  log "Downloading Meilisearch..."
  TMP="$(mktemp -d)"
  (
    cd "$TMP"
    curl -fsSL https://install.meilisearch.com | sh
    install -m 0755 ./meilisearch "$MEILI_BIN"
  )
  rm -rf "$TMP"
  log "Installed $MEILI_BIN"
}

write_env_file() {
  mkdir -p /etc/meilisearch "$(dirname "$MEILI_DATA")"
  chmod 700 /etc/meilisearch

  if [ -f "$MEILI_ENV" ]; then
    # shellcheck disable=SC1090
    set -a && source "$MEILI_ENV" && set +a
    log "Using existing $MEILI_ENV"
    return
  fi

  local key
  key="$(rand_key)"
  cat > "$MEILI_ENV" <<EOF
MEILI_ENV=production
MEILI_HTTP_ADDR=127.0.0.1:7700
MEILI_MASTER_KEY=${key}
MEILI_DB_PATH=${MEILI_DATA}
MEILI_NO_ANALYTICS=true
EOF
  chmod 600 "$MEILI_ENV"
  log "Created $MEILI_ENV"
}

install_systemd() {
  cat > /etc/systemd/system/meilisearch.service <<'UNIT'
[Unit]
Description=Meilisearch for SPLARO
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/meilisearch/env
ExecStart=/usr/local/bin/meilisearch
Restart=on-failure
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable meilisearch
  systemctl restart meilisearch
}

append_app_env() {
  local env_file="$APP_DIR/.env"
  [ -f "$env_file" ] || { log "WARN: $env_file missing — set MEILISEARCH_* manually"; return 0; }

  # shellcheck disable=SC1090
  set -a && source "$MEILI_ENV" && set +a
  local key="${MEILI_MASTER_KEY:-}"

  if ! grep -q '^MEILISEARCH_HOST=' "$env_file" 2>/dev/null; then
    echo "MEILISEARCH_HOST=${MEILI_HOST}" >> "$env_file"
    log "Appended MEILISEARCH_HOST to .env"
  fi
  if ! grep -q '^MEILISEARCH_MASTER_KEY=' "$env_file" 2>/dev/null && [ -n "$key" ]; then
    echo "MEILISEARCH_MASTER_KEY=${key}" >> "$env_file"
    log "Appended MEILISEARCH_MASTER_KEY to .env"
  fi
  chmod 600 "$env_file"
}

wait_healthy() {
  local i
  for i in $(seq 1 30); do
    if curl -sf "${MEILI_HOST}/health" >/dev/null 2>&1; then
      log "Meilisearch healthy on ${MEILI_HOST}"
      return 0
    fi
    sleep 1
  done
  log "WARN: Meilisearch health check timed out — check: journalctl -u meilisearch -n 50"
  return 1
}

log "Starting Meilisearch setup..."
install_binary
write_env_file
install_systemd
append_app_env
wait_healthy || true

log "Done. Reindex after deploy (admin auth required):"
log "  POST /api/v1/search/index/<storeId>"
