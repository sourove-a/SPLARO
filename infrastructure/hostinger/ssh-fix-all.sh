#!/bin/bash
# Full SPLARO fix on Hostinger — delegates to complete-production.sh (Neon Postgres only)
set +e
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"

REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
log() { echo "[fix-all $(date '+%H:%M:%S')] $*"; }

cd "$REPO" || exit 1
git pull origin main 2>/dev/null || true

if [ -f "$REPO/infrastructure/hostinger/complete-production.sh" ]; then
  log "Running complete-production.sh..."
  bash "$REPO/infrastructure/hostinger/complete-production.sh"
else
  log "Fallback: splaro-start-services.sh"
  bash "$REPO/infrastructure/hostinger/splaro-start-services.sh"
fi
