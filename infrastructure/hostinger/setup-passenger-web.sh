#!/bin/bash
# Configure Passenger Node.js for splaro.co storefront (after standalone build exists).
# Run on Hostinger via SSH or hPanel terminal.
set -euo pipefail

DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
USER_HOME="${HOME:?}"
REPO="${SPLARO_REPO_DIR:-$USER_HOME/domains/$DOMAIN/public_html/.builds/source/repository}"
APP_ROOT="${SPLARO_PASSENGER_DIR:-$USER_HOME/domains/$DOMAIN/nodejs}"
STANDALONE="$REPO/apps/web/.next/standalone/apps/web"

log() { echo "[passenger-web $(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$STANDALONE/server.js" ] || die "Missing $STANDALONE/server.js — upload/build standalone first"

mkdir -p "$APP_ROOT/tmp"
cp "$REPO/infrastructure/hostinger/passenger-web-app.cjs" "$APP_ROOT/app.cjs"

cat > "$USER_HOME/domains/$DOMAIN/public_html/.htaccess" <<HTEOF
PassengerAppRoot $APP_ROOT
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir $APP_ROOT/tmp
RewriteRule ^\.builds - [F,L]
DirectoryIndex disabled
HTEOF

[ -f "$USER_HOME/domains/$DOMAIN/public_html/default.php" ] && \
  mv "$USER_HOME/domains/$DOMAIN/public_html/default.php" \
     "$USER_HOME/domains/$DOMAIN/public_html/default.php.bak" || true

touch "$APP_ROOT/tmp/restart.txt"
log "Passenger configured — https://$DOMAIN"
log "Restart: touch $APP_ROOT/tmp/restart.txt"
