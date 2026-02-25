#!/usr/bin/env bash
set -euo pipefail

# SPLARO emergency recovery for admin.splaro.co on Hostinger shared hosting.
# Runs on server via SSH terminal.

MAIN_ROOT="/home/u134578371/domains/splaro.co/public_html"
SUBDOMAIN_ROOT="/home/u134578371/domains/admin.splaro.co/public_html"

pick_source_dir() {
  local candidates=(
    "$MAIN_ROOT/admin"
    "$MAIN_ROOT/public_html/admin"
  )

  local src=""
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate/index.html" && -f "$candidate/api/index.php" ]]; then
      src="$candidate"
      break
    fi
  done

  if [[ -z "$src" ]]; then
    echo "[recover-admin] ERROR: Could not locate admin source bundle." >&2
    echo "[recover-admin] Checked:" >&2
    for candidate in "${candidates[@]}"; do
      echo "  - $candidate" >&2
    done
    exit 1
  fi

  echo "$src"
}

copy_bundle() {
  local src="$1"
  local target="$2"
  mkdir -p "$target"

  # Remove known Hostinger placeholder files if present.
  rm -f "$target/default.php" "$target/index2.php" "$target/index.default.php"

  cp -a "$src"/. "$target"/
  find "$target" -type d -exec chmod 755 {} \;
  find "$target" -type f -exec chmod 644 {} \;
  chmod 755 "$target"
}

main() {
  local src
  src="$(pick_source_dir)"
  echo "[recover-admin] Using source: $src"

  echo "[recover-admin] Deploying to: $MAIN_ROOT/admin"
  copy_bundle "$src" "$MAIN_ROOT/admin"

  if [[ -d "$SUBDOMAIN_ROOT" || ! -e "$SUBDOMAIN_ROOT" ]]; then
    echo "[recover-admin] Deploying to: $SUBDOMAIN_ROOT"
    copy_bundle "$src" "$SUBDOMAIN_ROOT"
  fi

  echo "[recover-admin] DONE"
  echo "[recover-admin] Verify:"
  echo "  - https://admin.splaro.co/"
  echo "  - https://admin.splaro.co/api/index.php?action=health"
}

main "$@"
