#!/bin/bash
# splaro.co main domain — Passenger runs passenger-stack-app (web + api + admin proxy)
set +e
REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
[ -f "$REPO/pnpm-workspace.yaml" ] || REPO="$HOME/domains/splaro.co/nodejs"
DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
USER_HOME="${HOME:-/home/u134578371}"
APP_ROOT="$USER_HOME/domains/$DOMAIN/nodejs"
PUBLIC_HTML="$USER_HOME/domains/$DOMAIN/public_html"
log() { echo "[passenger-main $(date '+%H:%M:%S')] $*"; }
err() { echo "[passenger-main ERROR $(date '+%H:%M:%S')] $*" >&2; }

STACK_SRC="$REPO/infrastructure/hostinger/passenger-stack-app.cjs"
if [ ! -f "$STACK_SRC" ]; then
  err "missing $STACK_SRC"
  exit 1
fi

mkdir -p "$APP_ROOT/tmp" || { err "cannot create $APP_ROOT"; exit 1; }
cp "$STACK_SRC" "$APP_ROOT/app.cjs"

cat > "$PUBLIC_HTML/.htaccess" <<EOF
PassengerAppRoot ${APP_ROOT}
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${APP_ROOT}/tmp
RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.splaro\.co [NC]
RewriteRule ^ https://splaro.co%{REQUEST_URI} [R=301,L]
RewriteRule ^\.builds - [F,L]
RewriteRule ^index\.php$ - [L]
DirectoryIndex disabled
Options -Indexes
EOF

for stale in default.php index.php index.html default.htm; do
  if [ -f "$PUBLIC_HTML/$stale" ]; then
    mv "$PUBLIC_HTML/$stale" "$PUBLIC_HTML/${stale}.splaro-bak" 2>/dev/null || rm -f "$PUBLIC_HTML/$stale"
  fi
done

touch "$APP_ROOT/tmp/restart.txt"
log "splaro.co Passenger → stack app (web + api + proxy) ($APP_ROOT/app.cjs)"
