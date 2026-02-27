#!/usr/bin/env bash
set -euo pipefail

# SPLARO full production reset for Hostinger shared hosting.
# Purpose: force clean redeploy of storefront + admin bundles and verify core API health.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

ACCOUNT_HOME="${ACCOUNT_HOME:-/home/u134578371}"
MAIN_ROOT="${MAIN_ROOT:-$ACCOUNT_HOME/domains/splaro.co/public_html}"
ADMIN_ROOT_MAIN="${ADMIN_ROOT_MAIN:-$MAIN_ROOT/admin}"
ADMIN_ROOT_SUB="${ADMIN_ROOT_SUB:-$ACCOUNT_HOME/domains/admin.splaro.co/public_html}"

SOURCE_PUBLIC="${SOURCE_PUBLIC:-$REPO_ROOT/public_html}"
SOURCE_ADMIN="${SOURCE_ADMIN:-$REPO_ROOT/public_html/admin}"

log() {
  echo "[reset-all] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[reset-all] ERROR: missing required command: $cmd" >&2
    exit 1
  fi
}

assert_source_bundle() {
  local src="$1"
  local label="$2"
  if [[ ! -f "$src/index.html" ]]; then
    echo "[reset-all] ERROR: $label bundle missing index.html at $src" >&2
    exit 1
  fi
  if [[ ! -f "$src/api/index.php" ]]; then
    echo "[reset-all] ERROR: $label bundle missing api/index.php at $src" >&2
    exit 1
  fi
}

json_field() {
  local field="$1"
  php -r '
    $input = stream_get_contents(STDIN);
    $json = json_decode((string)$input, true);
    if (!is_array($json)) { echo ""; exit(0); }
    $field = $argv[1] ?? "";
    $value = $json[$field] ?? "";
    if (is_scalar($value)) {
      echo (string)$value;
    }
  ' "$field"
}

remove_hostinger_placeholders() {
  local target="$1"
  rm -f \
    "$target/default.php" \
    "$target/index2.php" \
    "$target/index.default.php"
}

sync_tree() {
  local src="$1"
  local dst="$2"
  local label="$3"

  log "Deploying $label: $src -> $dst"
  mkdir -p "$dst"
  remove_hostinger_placeholders "$dst"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '.env' \
      --exclude '.env.local' \
      --exclude '.env.production' \
      "$src"/ "$dst"/
  else
    find "$dst" -mindepth 1 \
      ! -name '.env' \
      ! -name '.env.local' \
      ! -name '.env.production' \
      -exec rm -rf {} +
    cp -a "$src"/. "$dst"/
  fi

  find "$dst" -type d -exec chmod 755 {} \;
  find "$dst" -type f -exec chmod 644 {} \;
  chmod 755 "$dst"
}

probe_health() {
  local url="$1"
  local body status message

  body="$(curl -sS --max-time 20 "$url" || true)"
  status="$(printf '%s' "$body" | json_field "status")"
  message="$(printf '%s' "$body" | json_field "message")"

  if [[ "$status" == "error" && "$message" == "ADMIN_ACCESS_REQUIRED" ]]; then
    log "Health probe OK: $url -> $status/$message"
    return 0
  fi

  echo "[reset-all] ERROR: Unexpected health response from $url" >&2
  echo "[reset-all] BODY: $body" >&2
  return 1
}

api_post() {
  local url="$1"
  local body="$2"
  local key="$3"
  curl -sS --max-time 25 \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: $key" \
    -H "X-API-Key: $key" \
    -d "$body" \
    "$url"
}

run_product_smoke() {
  local adminKey="$1"
  local testId payload syncBody deleteBody
  local adminSync adminDelete storeSync storeDelete
  local adminSyncStatus adminSyncMessage
  local adminDeleteStatus adminDeleteMessage
  local storeSyncStatus storeSyncMessage
  local storeDeleteStatus storeDeleteMessage

  testId="reset-smoke-$(date +%s)"
  payload="$(cat <<JSON
{"products":[{"id":"$testId","name":"Reset Smoke Product","slug":"$testId","brand":"Splaro","brandSlug":"splaro","category":"Shoes","categorySlug":"shoes","subCategory":"Sneakers","subCategorySlug":"sneakers","type":"Men","price":11111,"stock":3,"description":{"en":"smoke"},"status":"Published","image":"https://images.unsplash.com/photo-1542291026-7eec264c27ff","mainImageId":"img_main_$testId","galleryImages":[{"id":"img_main_$testId","url":"https://images.unsplash.com/photo-1542291026-7eec264c27ff","isMain":true,"sortOrder":0}],"sizes":["40"],"colors":[{"name":"Black","hex":"#111111"}],"materials":["Leather"],"tags":[],"featured":false,"sku":"SKU-$testId","barcode":"","hideWhenOutOfStock":false,"weight":"0.8kg","dimensions":{"length":"32cm","width":"20cm","height":"12cm"},"variations":[],"additionalImages":[],"sizeChartImage":"","discountPercentage":0,"productUrl":"https://splaro.co/product/splaro/shoes/$testId"}],"purgeMissing":false}
JSON
)"
  deleteBody="{\"id\":\"$testId\"}"

  syncBody="$(api_post "https://admin.splaro.co/api/index.php?action=sync_products" "$payload" "$adminKey")"
  adminSyncStatus="$(printf '%s' "$syncBody" | json_field "status")"
  adminSyncMessage="$(printf '%s' "$syncBody" | json_field "message")"
  log "ADMIN sync -> $adminSyncStatus/$adminSyncMessage"
  if [[ "$adminSyncStatus" != "success" ]]; then
    echo "[reset-all] ERROR: admin sync failed" >&2
    echo "[reset-all] BODY: $syncBody" >&2
    return 1
  fi

  adminDelete="$(api_post "https://admin.splaro.co/api/index.php?action=delete_product" "$deleteBody" "$adminKey")"
  adminDeleteStatus="$(printf '%s' "$adminDelete" | json_field "status")"
  adminDeleteMessage="$(printf '%s' "$adminDelete" | json_field "message")"
  log "ADMIN delete -> $adminDeleteStatus/$adminDeleteMessage"
  if [[ "$adminDeleteStatus" != "success" && "$adminDeleteMessage" != "PRODUCT_NOT_FOUND" ]]; then
    echo "[reset-all] ERROR: admin delete failed" >&2
    echo "[reset-all] BODY: $adminDelete" >&2
    return 1
  fi

  storeSync="$(api_post "https://splaro.co/api/index.php?action=sync_products" "$payload" "$adminKey")"
  storeSyncStatus="$(printf '%s' "$storeSync" | json_field "status")"
  storeSyncMessage="$(printf '%s' "$storeSync" | json_field "message")"
  log "STORE sync -> $storeSyncStatus/$storeSyncMessage"
  if [[ "$storeSyncStatus" != "success" ]]; then
    echo "[reset-all] ERROR: storefront sync failed" >&2
    echo "[reset-all] BODY: $storeSync" >&2
    return 1
  fi

  storeDelete="$(api_post "https://splaro.co/api/index.php?action=delete_product" "$deleteBody" "$adminKey")"
  storeDeleteStatus="$(printf '%s' "$storeDelete" | json_field "status")"
  storeDeleteMessage="$(printf '%s' "$storeDelete" | json_field "message")"
  log "STORE delete -> $storeDeleteStatus/$storeDeleteMessage"
  if [[ "$storeDeleteStatus" != "success" && "$storeDeleteMessage" != "PRODUCT_NOT_FOUND" ]]; then
    echo "[reset-all] ERROR: storefront delete failed" >&2
    echo "[reset-all] BODY: $storeDelete" >&2
    return 1
  fi
}

main() {
  require_cmd curl
  require_cmd php

  assert_source_bundle "$SOURCE_PUBLIC" "storefront"
  assert_source_bundle "$SOURCE_ADMIN" "admin"

  log "Source repo: $REPO_ROOT"
  log "Storefront target: $MAIN_ROOT"
  log "Admin target: $ADMIN_ROOT_MAIN"
  if [[ -d "$(dirname "$ADMIN_ROOT_SUB")" || ! -e "$ADMIN_ROOT_SUB" ]]; then
    log "Admin subdomain target: $ADMIN_ROOT_SUB"
  fi

  sync_tree "$SOURCE_PUBLIC" "$MAIN_ROOT" "storefront"
  sync_tree "$SOURCE_ADMIN" "$ADMIN_ROOT_MAIN" "admin(main)"

  if [[ -d "$(dirname "$ADMIN_ROOT_SUB")" || ! -e "$ADMIN_ROOT_SUB" ]]; then
    sync_tree "$SOURCE_ADMIN" "$ADMIN_ROOT_SUB" "admin(subdomain)"
  fi

  probe_health "https://admin.splaro.co/api/index.php?action=health"
  probe_health "https://splaro.co/api/index.php?action=health"

  if [[ -n "${ADMIN_KEY:-}" ]]; then
    log "Running product add/delete smoke test..."
    run_product_smoke "$ADMIN_KEY"
  else
    log "Skipping product smoke test: ADMIN_KEY not provided."
    log "To run with smoke test: ADMIN_KEY='<key>' bash scripts/hostinger-reset-all.sh"
  fi

  log "DONE"
  log "Verify UI:"
  log "  - https://admin.splaro.co/admin_dashboard?tab=products"
  log "  - https://splaro.co/login"
  log "  - https://splaro.co/signup"
}

main "$@"
