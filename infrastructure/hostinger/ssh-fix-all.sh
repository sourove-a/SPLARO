#!/bin/bash
# Full SPLARO fix on Hostinger — delegates to fix-all-live.sh (API + web + admin + DB)
set +e
export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"

REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
log() { echo "[fix-all $(date '+%H:%M:%S')] $*"; }

cd "$REPO" || exit 1
git pull origin main 2>/dev/null || true

if [ -f "$REPO/infrastructure/hostinger/fix-all-live.sh" ]; then
  log "Running fix-all-live.sh..."
  bash "$REPO/infrastructure/hostinger/fix-all-live.sh"
elif [ -f "$REPO/infrastructure/hostinger/complete-production.sh" ]; then
  log "Running complete-production.sh..."
  bash "$REPO/infrastructure/hostinger/complete-production.sh"
else
  bash "$REPO/infrastructure/hostinger/splaro-start-services.sh"
fi
