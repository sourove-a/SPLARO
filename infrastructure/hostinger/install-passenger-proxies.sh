#!/bin/bash
# Configure admin.splaro.co + api.splaro.co Passenger proxies (runs during Git build).
set +e
REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
[ -f "$REPO/pnpm-workspace.yaml" ] || REPO="$HOME/domains/splaro.co/nodejs"
USER_HOME="${HOME:-/home/u134578371}"
log() { echo "[passenger-install $(date '+%H:%M:%S')] $*"; }
err() { echo "[passenger-install ERROR $(date '+%H:%M:%S')] $*" >&2; }

write_htaccess() {
  local root="$1" nodejs="$2" startup="$3"
  mkdir -p "$nodejs/tmp" || return 1
  cat > "$root/.htaccess" <<EOF
PassengerAppRoot ${nodejs}
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile ${startup}
PassengerBaseURI /
PassengerRestartDir ${nodejs}/tmp
DirectoryIndex disabled
RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.splaro\.co [NC]
RewriteRule ^ https://splaro.co%{REQUEST_URI} [R=301,L]
RewriteRule ^\.builds - [F,L]
EOF
  touch "$nodejs/tmp/restart.txt"
}

install_proxy() {
  local label="$1" htdocs="$2" proxy_src="$3" port_hint="$4"
  mkdir -p "$htdocs" || true
  if ! mkdir -p "$htdocs/nodejs"; then
    err "cannot create $htdocs — $label proxy skipped"
    return 1
  fi
  if [ ! -f "$REPO/$proxy_src" ]; then
    err "missing $proxy_src — $label proxy skipped"
    return 1
  fi
  cp "$REPO/$proxy_src" "$htdocs/nodejs/app.cjs"
  if write_htaccess "$htdocs" "$htdocs/nodejs" "app.cjs"; then
    for stale in default.php index.php index.html; do
      if [ -f "$htdocs/$stale" ]; then
        mv "$htdocs/$stale" "$htdocs/${stale}.splaro-bak" 2>/dev/null || rm -f "$htdocs/$stale"
      fi
    done
    log "$label proxy → $port_hint ($htdocs)"
  else
    err "failed to write .htaccess for $label"
    return 1
  fi
}

# admin — public_html/admin (subdomain admin.splaro.co)
ADMIN_HTDOCS="$USER_HOME/domains/splaro.co/public_html/admin"
install_proxy "admin" "$ADMIN_HTDOCS" "infrastructure/hostinger/passenger-admin-proxy.cjs" ":3002"

# api — public_html/api (hPanel also routes splaro.co apex through this vhost)
API_HTDOCS="$USER_HOME/domains/splaro.co/public_html/api"
install_proxy "api" "$API_HTDOCS" "infrastructure/hostinger/passenger-proxy-only.cjs" ":4000 + web :3001"

# Legacy separate domain folders
LEGACY_ADMIN="$USER_HOME/domains/admin.splaro.co/nodejs"
if [ -d "$(dirname "$LEGACY_ADMIN")" ]; then
  mkdir -p "$LEGACY_ADMIN/tmp"
  cp "$REPO/infrastructure/hostinger/passenger-admin-proxy.cjs" "$LEGACY_ADMIN/app.cjs" 2>/dev/null || true
  touch "$LEGACY_ADMIN/tmp/restart.txt" 2>/dev/null || true
  log "legacy admin.splaro.co nodejs updated"
fi

log "Passenger proxies installed"
