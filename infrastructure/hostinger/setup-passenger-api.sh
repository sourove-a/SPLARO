#!/bin/bash
# Deploy SPLARO API to api.splaro.co (Passenger Node.js)
# Requires: hPanel → Subdomains → create api.splaro.co first
set -euo pipefail

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
API_ROOT="${SPLARO_API_ROOT:-$HOME/domains/api.splaro.co}"
NODEJS_DIR="$API_ROOT/nodejs"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"

log() { echo "[passenger-api $(date '+%H:%M:%S')] $*"; }

API_MAIN="$REPO/apps/api/dist/main.js"
if [ ! -f "$API_MAIN" ]; then
  log "API build missing — build first:"
  log "  cd $REPO && pnpm --filter @splaro/api run build"
  exit 1
fi

if [ ! -d "$API_ROOT" ]; then
  log "WARNING: $API_ROOT not found — create api.splaro.co subdomain in hPanel first"
  exit 1
fi

mkdir -p "$NODEJS_DIR/tmp" "$API_ROOT/public_html"
cp "$REPO/infrastructure/hostinger/passenger-api-app.cjs" "$NODEJS_DIR/app.cjs"

cat > "$API_ROOT/public_html/.htaccess" <<EOF
PassengerAppRoot $NODEJS_DIR
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir $NODEJS_DIR/tmp
DirectoryIndex disabled
EOF

touch "$NODEJS_DIR/tmp/restart.txt"
log "API Passenger configured — https://api.splaro.co/api/v1/health"
