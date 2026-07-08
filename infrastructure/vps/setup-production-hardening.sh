#!/bin/bash
# SPLARO VPS — production hardening (swap, firewall, backups, splaro.com.bd redirect)
# Run as root after go-live:
#   bash /var/www/splaro/infrastructure/vps/setup-production-hardening.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
SWAP_GB="${SPLARO_SWAP_GB:-2}"
BACKUP_SCRIPT="$APP_DIR/infrastructure/vps/backup-local-only.sh"

log() { echo "[hardening $(date '+%H:%M:%S')] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

# ── Swap ─────────────────────────────────────────────────────
if ! swapon --show | grep -q .; then
  log "Adding ${SWAP_GB}G swap..."
  fallocate -l "${SWAP_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_GB * 1024))
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "Swap enabled"
else
  log "Swap already active"
fi

# ── Firewall ─────────────────────────────────────────────────
log "Configuring UFW..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
log "UFW: $(ufw status | head -1)"

# ── Backup dirs + cron ───────────────────────────────────────
mkdir -p /var/backups/splaro /var/log/splaro
chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true

CRON_LINE="0 3 * * * bash $BACKUP_SCRIPT >> /var/log/splaro/backup.log 2>&1"
{
  crontab -l 2>/dev/null | grep -Fv 'backup-local-only.sh' || true
  echo "$CRON_LINE"
} | crontab -
log "Daily DB backup cron installed (03:00 UTC)"

# ── splaro.com.bd → splaro.co (when DNS points here) ─────────
BD_CONF="/etc/nginx/sites-available/splaro.com.bd.conf"
if [ ! -f "$BD_CONF" ]; then
  cat > "$BD_CONF" <<'NGINX'
# SPLARO Bangladesh domain — redirect to primary splaro.co
server {
    listen 80;
    listen [::]:80;
    server_name splaro.com.bd www.splaro.com.bd;
    return 301 https://splaro.co$request_uri;
}
NGINX
  ln -sf "$BD_CONF" /etc/nginx/sites-enabled/splaro.com.bd.conf
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "splaro.com.bd HTTP redirect configured (add DNS A record → this VPS, then certbot)"
  else
    log "WARN: nginx test failed — splaro.com.bd config skipped"
    rm -f /etc/nginx/sites-enabled/splaro.com.bd.conf
  fi
fi

# ── Certbot auto-renew sanity ────────────────────────────────
if command -v certbot >/dev/null; then
  certbot renew --dry-run >/dev/null 2>&1 && log "Certbot renew dry-run OK" || log "WARN: certbot renew dry-run failed (non-fatal)"
fi

echo ""
log "Production hardening complete."
echo "  ✓ Swap ${SWAP_GB}G"
echo "  ✓ UFW (SSH + Nginx)"
echo "  ✓ Daily PostgreSQL backup → /var/backups/splaro"
echo "  ✓ splaro.com.bd redirect template"
echo ""
echo "Still manual (add keys in $APP_DIR/.env):"
echo "  • bKash / SSLCommerz / Nagad payment credentials"
echo "  • Steadfast / Pathao courier API keys"
echo "  • Cloudflare R2 (CDN) + OPENAI_API_KEY (AI agent)"
echo "  • META_PIXEL_ID / GOOGLE_ANALYTICS_ID"
