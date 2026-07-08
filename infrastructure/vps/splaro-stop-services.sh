#!/bin/bash
# Stop SPLARO only on the shared VPS (hunterflow / other PM2 apps stay running).
# Safe to run before pointing DNS to Hostinger shared hosting.
set -euo pipefail

echo "[splaro-stop] Stopping SPLARO PM2 processes only (splaro-api, splaro-web, splaro-admin)…"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[splaro-stop] pm2 not found — nothing to stop."
  exit 0
fi

for proc in splaro-api splaro-web splaro-admin; do
  if pm2 describe "$proc" >/dev/null 2>&1; then
    pm2 stop "$proc" || true
    pm2 delete "$proc" || true
    echo "[splaro-stop] stopped $proc"
  else
    echo "[splaro-stop] skip $proc (not running)"
  fi
done

pm2 save || true

echo "[splaro-stop] Remaining PM2 apps (should include hunterflow if present):"
pm2 list || true

echo "[splaro-stop] Done. SPLARO is off on this VPS."
echo "[splaro-stop] Next: point splaro.co DNS to Hostinger IP, then deploy via hPanel Git."
