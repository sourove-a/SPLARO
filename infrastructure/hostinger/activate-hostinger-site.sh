#!/bin/bash
# Remove Hostinger default PHP page + wire Passenger (splaro.co + admin + api).
# Runs during npm run build on Hostinger — no manual SSH required.
set +e
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
[ -f "$REPO/pnpm-workspace.yaml" ] || REPO="$HOME/domains/splaro.co/nodejs"
DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
USER_HOME="${HOME:-/home/u134578371}"
PUBLIC_HTML="$USER_HOME/domains/$DOMAIN/public_html"
NODEJS="$USER_HOME/domains/$DOMAIN/nodejs"
ADMIN_HTDOCS="$PUBLIC_HTML/admin"
API_HTDOCS="$PUBLIC_HTML/api"

log() { echo "[activate-site $(date '+%H:%M:%S')] $*"; }

disable_hostinger_defaults() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  for f in default.php index.php index.html default.htm; do
    if [ -f "$dir/$f" ]; then
      mv "$dir/$f" "$dir/${f}.splaro-bak" 2>/dev/null || rm -f "$dir/$f"
      log "disabled $dir/$f"
    fi
  done
}

disable_hostinger_defaults "$PUBLIC_HTML"
disable_hostinger_defaults "$ADMIN_HTDOCS"
disable_hostinger_defaults "$API_HTDOCS"

mkdir -p "$NODEJS/tmp" "$ADMIN_HTDOCS/nodejs/tmp" "$API_HTDOCS/nodejs/tmp"

STACK_SRC="$REPO/infrastructure/hostinger/passenger-stack-app.cjs"
PROXY_SRC="$REPO/infrastructure/hostinger/passenger-proxy-only.cjs"
ADMIN_SRC="$REPO/infrastructure/hostinger/passenger-admin-proxy.cjs"

if [ ! -f "$STACK_SRC" ]; then
  log "ERROR: missing $STACK_SRC"
  exit 1
fi

cp "$STACK_SRC" "$NODEJS/app.cjs"

cat > "$PUBLIC_HTML/.htaccess" <<EOF
PassengerAppRoot ${NODEJS}
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${NODEJS}/tmp
DirectoryIndex disabled
Options -Indexes
RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.splaro\.co [NC]
RewriteRule ^ https://splaro.co%{REQUEST_URI} [R=301,L]
RewriteRule ^\.builds - [F,L]
RewriteRule ^index\.php$ - [L]
EOF
touch "$NODEJS/tmp/restart.txt"
log "splaro.co → passenger-stack-app (web + api + admin backends)"

if [ -f "$ADMIN_SRC" ]; then
  cp "$ADMIN_SRC" "$ADMIN_HTDOCS/nodejs/app.cjs"
  cat > "$ADMIN_HTDOCS/.htaccess" <<EOF
PassengerAppRoot ${ADMIN_HTDOCS}/nodejs
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${ADMIN_HTDOCS}/nodejs/tmp
DirectoryIndex disabled
Options -Indexes
RewriteEngine On
RewriteRule ^index\.php$ - [L]
EOF
  touch "$ADMIN_HTDOCS/nodejs/tmp/restart.txt"
  log "admin.splaro.co → public_html/admin (enable SSL in hPanel → SSL → admin)"
fi

if [ -f "$PROXY_SRC" ]; then
  cp "$PROXY_SRC" "$API_HTDOCS/nodejs/app.cjs"
  cat > "$API_HTDOCS/.htaccess" <<EOF
PassengerAppRoot ${API_HTDOCS}/nodejs
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile app.cjs
PassengerBaseURI /
PassengerRestartDir ${API_HTDOCS}/nodejs/tmp
DirectoryIndex disabled
Options -Indexes
RewriteEngine On
RewriteRule ^index\.php$ - [L]
EOF
  touch "$API_HTDOCS/nodejs/tmp/restart.txt"
  log "api.splaro.co → public_html/api"
fi

log "activate-site done — redeploy or touch $NODEJS/tmp/restart.txt if needed"
