#!/bin/bash
# Deploy SPLARO admin to admin.splaro.co (Passenger Node.js)
set -euo pipefail

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
ADMIN_ROOT="${SPLARO_ADMIN_ROOT:-$HOME/domains/admin.splaro.co}"
NODEJS_DIR="$ADMIN_ROOT/nodejs"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"

log() { echo "[passenger-admin $(date '+%H:%M:%S')] $*"; }

STANDALONE="$REPO/apps/admin/.next/standalone/apps/admin/server.js"
if [ ! -f "$STANDALONE" ]; then
  log "Admin standalone missing — build first:"
  log "  cd $REPO && SPLARO_HOSTINGER=1 pnpm --filter @splaro/admin run build"
  log "  node scripts/prepare-next-standalone.mjs apps/admin"
  exit 1
fi

mkdir -p "$NODEJS_DIR/tmp"
cp "$REPO/infrastructure/hostinger/passenger-admin-app.cjs" "$NODEJS_DIR/app.cjs"

cat > "$ADMIN_ROOT/public_html/.htaccess" <<'EOF'
PassengerAppRoot /home/u134578371/domains/admin.splaro.co/nodejs
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir /home/u134578371/domains/admin.splaro.co/nodejs/tmp
DirectoryIndex disabled
EOF

touch "$NODEJS_DIR/tmp/restart.txt"
log "Admin Passenger configured — ensure DNS: admin.splaro.co → server IP"
