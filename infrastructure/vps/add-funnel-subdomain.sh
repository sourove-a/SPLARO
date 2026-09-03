#!/usr/bin/env bash
#
# Publish a D2C funnel subdomain: nginx server block + its own certificate.
#
# Why per-host and not a wildcard: splaro.co runs on Hostinger DNS, which has no
# certbot plugin. A *.splaro.co certificate would need a DNS TXT record typed by
# hand at every renewal, so it would lapse the first time nobody was watching.
# An HTTP-01 certificate per subdomain renews itself on the timer that is
# already running.
#
# Safe to re-run: an existing block is backed up before it is replaced, nginx is
# only reloaded after `nginx -t` passes, and the script ends by asking the live
# host for a 200 rather than assuming one.
#
# Usage (on the VPS, as root):
#   ./add-funnel-subdomain.sh lifestyle
#   ./add-funnel-subdomain.sh lifestyle.splaro.co
#   ./add-funnel-subdomain.sh --list
#   DRY_RUN=1 ./add-funnel-subdomain.sh newdrop
set -euo pipefail

APEX="${SPLARO_APEX_DOMAIN:-splaro.co}"
APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
TEMPLATE="${SPLARO_FUNNEL_TEMPLATE:-$APP_DIR/infrastructure/vps/nginx-funnel-subdomain.template.conf}"
SITES_AVAILABLE=/etc/nginx/sites-available
SITES_ENABLED=/etc/nginx/sites-enabled
WEBROOT="${SPLARO_CERTBOT_WEBROOT:-/var/www/certbot}"
CERT_EMAIL="${SPLARO_CERT_EMAIL:-info@splaro.co}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '[funnel-subdomain] %s\n' "$*"; }
die() { printf '[funnel-subdomain] ERROR: %s\n' "$*" >&2; exit 1; }
run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[dry-run] %s\n' "$*"
  else
    eval "$@"
  fi
}

if [ "${1:-}" = "--list" ]; then
  log "funnel subdomains currently published:"
  for conf in "$SITES_ENABLED"/splaro-funnel-*.conf "$SITES_ENABLED"/splaro-lifestyle.conf; do
    [ -e "$conf" ] || continue
    host=$(grep -m1 -oE 'server_name[[:space:]]+[^;]+' "$conf" | awk '{print $2}')
    cert_dir="/etc/letsencrypt/live/$host"
    if [ -d "$cert_dir" ]; then
      expiry=$(openssl x509 -enddate -noout -in "$cert_dir/fullchain.pem" 2>/dev/null | cut -d= -f2)
      printf '  %-32s cert until %s\n' "$host" "${expiry:-unknown}"
    else
      printf '  %-32s NO CERTIFICATE\n' "$host"
    fi
  done
  exit 0
fi

RAW="${1:-}"
[ -n "$RAW" ] || die "usage: $0 <subdomain>   (e.g. $0 lifestyle)"

# Accept either the label or the full host, and reject anything that would end
# up in a server_name or a file path without being a hostname.
HOST="${RAW%.}"
case "$HOST" in
  *".$APEX") LABEL="${HOST%.$APEX}" ;;
  *".."*|*"/"*) die "invalid subdomain: $RAW" ;;
  *) LABEL="$HOST"; HOST="$LABEL.$APEX" ;;
esac
[[ "$LABEL" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || die "invalid subdomain label: $LABEL"

CONF_NAME="splaro-funnel-$LABEL.conf"
CONF_PATH="$SITES_AVAILABLE/$CONF_NAME"
# The first subdomain was published by hand as splaro-lifestyle.conf; adopt that
# file rather than serving the same host from two blocks.
LEGACY_PATH="$SITES_AVAILABLE/splaro-lifestyle.conf"
if [ "$LABEL" = "lifestyle" ] && [ -f "$LEGACY_PATH" ] && [ ! -f "$CONF_PATH" ]; then
  CONF_NAME="splaro-lifestyle.conf"
  CONF_PATH="$LEGACY_PATH"
  log "adopting existing hand-written block at $CONF_PATH"
fi

[ -f "$TEMPLATE" ] || die "template not found: $TEMPLATE"
[ -d "$SITES_AVAILABLE" ] || die "nginx sites-available missing — is nginx installed?"

log "host:     $HOST"
log "conf:     $CONF_PATH"
log "template: $TEMPLATE"

# 1. DNS has to point here before Let's Encrypt will validate anything.
resolved=$(getent hosts "$HOST" | awk '{print $1}' | head -1 || true)
server_ip=$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)
if [ -z "$resolved" ]; then
  die "$HOST does not resolve. Add the DNS record (wildcard *.$APEX or an A record) first."
fi
if [ -n "$server_ip" ] && [ "$resolved" != "$server_ip" ]; then
  log "WARNING: $HOST resolves to $resolved but this server is $server_ip"
  log "         issuance will fail unless that is a proxy in front of this box."
fi

mkdir -p "$WEBROOT"

# 2. HTTP-only block first: certbot needs to be able to answer the challenge on
#    port 80, and the TLS block cannot load before its certificate exists.
if [ ! -d "/etc/letsencrypt/live/$HOST" ]; then
  log "no certificate yet — publishing the ACME-only block"
  TMP_HTTP=$(mktemp)
  cat >"$TMP_HTTP" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
NGINX
  run "install -m 0644 '$TMP_HTTP' '$CONF_PATH'"
  rm -f "$TMP_HTTP"
  run "ln -sfn '$CONF_PATH' '$SITES_ENABLED/$CONF_NAME'"
  run "nginx -t"
  run "systemctl reload nginx"

  log "requesting certificate for $HOST"
  run "certbot certonly --webroot -w '$WEBROOT' -d '$HOST' \
        --non-interactive --agree-tos -m '$CERT_EMAIL' --keep-until-expiring"
else
  log "certificate already present for $HOST"
fi

if [ "$DRY_RUN" != "1" ] && [ ! -d "/etc/letsencrypt/live/$HOST" ]; then
  die "certbot did not produce /etc/letsencrypt/live/$HOST — leaving the HTTP block in place"
fi

# 3. Full block from the template, with the previous one kept aside.
if [ -f "$CONF_PATH" ]; then
  run "cp -a '$CONF_PATH' '$CONF_PATH.bak.\$(date +%s)'"
fi
TMP_FULL=$(mktemp)
sed "s/__HOST__/$HOST/g" "$TEMPLATE" >"$TMP_FULL"
run "install -m 0644 '$TMP_FULL' '$CONF_PATH'"
rm -f "$TMP_FULL"
run "ln -sfn '$CONF_PATH' '$SITES_ENABLED/$CONF_NAME'"

run "nginx -t"
run "systemctl reload nginx"

# 4. Ask the live host, rather than assuming the reload did what it looked like.
if [ "$DRY_RUN" = "1" ]; then
  log "dry run complete — nothing was written"
  exit 0
fi

sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$HOST/" || echo 000)
if [ "$code" = "200" ]; then
  log "https://$HOST → 200 ✓"
  log "the drop still needs a funnel universe pointed at subdomain '$LABEL' in the admin."
else
  log "WARNING: https://$HOST returned $code"
  log "nginx and the certificate are in place; check the app and the funnel record."
fi
