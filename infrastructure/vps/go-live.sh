#!/bin/bash
# SPLARO — Fresh VPS go-live (Ubuntu 22.04+, run as root)
# Installs stack if needed, deploys web + admin + api + worker.
#
# Usage (on VPS):
#   git clone https://github.com/sourove-a/SPLARO.git /var/www/splaro
#   cp your.env /var/www/splaro/.env
#   bash /var/www/splaro/infrastructure/vps/go-live.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
REPO_URL="${SPLARO_REPO:-https://github.com/sourove-a/SPLARO.git}"
BRANCH="${SPLARO_BRANCH:-main}"
LOG_DIR="/var/log/splaro"
SKIP_SETUP="${SKIP_SERVER_SETUP:-false}"

log() { echo "[go-live $(date '+%H:%M:%S')] $*"; }
die() { echo "[go-live] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash infrastructure/vps/go-live.sh"

log "SPLARO go-live — domain=$DOMAIN app=$APP_DIR"

# ── Clone repo (needed before .env / setup) ──────────────────
mkdir -p "$APP_DIR" "$LOG_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  log "Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ── Environment (before server setup — DB password must match) ─
if [ ! -f .env ]; then
  if [ -f infrastructure/vps/.env.production.generated ]; then
    cp infrastructure/vps/.env.production.generated .env
  elif [ -f .env.example ]; then
    bash infrastructure/hostinger/generate-production-env.sh > .env
    log "Generated .env — set TELEGRAM_BOT_TOKEN before traffic"
  else
    die ".env missing — run on Mac: pnpm prep:vps"
  fi
fi
chmod 600 .env

# shellcheck disable=SC1091
set -a && source .env && set +a

# Extract DB password for setup-server.sh
if [[ "${DATABASE_URL:-}" == *"@127.0.0.1"* ]] || [[ "${DATABASE_URL:-}" == *"@localhost"* ]]; then
  export SPLARO_DB_PASS="$(node -e "
    const u = process.env.DATABASE_URL.replace(/^postgresql:\\/\\//,'');
    const at = u.lastIndexOf('@');
    const auth = u.slice(0, at);
    const colon = auth.indexOf(':');
    console.log(decodeURIComponent(auth.slice(colon + 1)));
  ")"
fi

# ── First-time server setup ──────────────────────────────────
if [ "$SKIP_SETUP" != "true" ] && ! command -v psql >/dev/null 2>&1; then
  log "First run — installing Node, PostgreSQL, Redis, Nginx, PM2..."
  bash "$APP_DIR/infrastructure/scripts/setup-server.sh"
elif [ -n "${SPLARO_DB_PASS:-}" ] && command -v psql >/dev/null 2>&1; then
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='splaro_user'" | grep -q 1 && \
    sudo -u postgres psql -c "ALTER USER splaro_user WITH PASSWORD '${SPLARO_DB_PASS}';" 2>/dev/null || true
fi

# ── Pull latest ──────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "Pulling latest..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

cd "$APP_DIR"

export SPLARO_APP_DIR="$APP_DIR"
export SPLARO_LOG_DIR="$LOG_DIR"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://${DOMAIN}/api/v1}"
export WEB_URL="${WEB_URL:-https://splaro.co}"
export ADMIN_URL="${ADMIN_URL:-https://admin.splaro.co}"
export API_URL="${API_URL:-https://splaro.co}"
export CORS_ORIGINS="${CORS_ORIGINS:-https://splaro.co,https://admin.splaro.co}"
export PAYMENT_DEV_STUB="${PAYMENT_DEV_STUB:-false}"

[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL missing in .env"

# ── pnpm ─────────────────────────────────────────────────────
bash "$APP_DIR/infrastructure/hostinger/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-/root/.local/share/pnpm}"
export PATH="$PNPM_HOME:/root/.local/bin:$PATH"
command -v pnpm >/dev/null || npm install -g pnpm
log "pnpm $(pnpm --version)"

# ── Build & deploy ───────────────────────────────────────────
log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Prisma generate + migrate..."
pnpm db:generate
pnpm db:migrate:prod || pnpm db:push

log "Seed (idempotent)..."
pnpm db:seed || log "Seed skipped — check if first deploy"

log "Building all apps..."
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=6144"
pnpm build:all

log "Preparing Next.js standalone..."
node scripts/prepare-next-standalone.mjs apps/web
node scripts/prepare-next-standalone.mjs apps/admin

# ── PM2 (start before nginx so health checks work) ───────────
command -v pm2 >/dev/null || npm install -g pm2

log "Starting PM2 (full stack)..."
pm2 startOrReload infrastructure/pm2/ecosystem.config.js --update-env
pm2 save

# ── Nginx ────────────────────────────────────────────────────
log "Configuring Nginx..."
mkdir -p /var/www/certbot
rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true

if [ ! -d "/etc/letsencrypt/live/splaro.co" ]; then
  log "No SSL yet — HTTP bootstrap + certbot (DNS must point here)..."
  cp infrastructure/vps/nginx-http-bootstrap.conf /etc/nginx/sites-available/splaro-bootstrap.conf
  ln -sf /etc/nginx/sites-available/splaro-bootstrap.conf /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  certbot certonly --webroot \
    -w /var/www/certbot \
    -d splaro.co \
    -d www.splaro.co \
    -d admin.splaro.co \
    --email "${ADMIN_EMAIL:-splaro.bd@gmail.com}" \
    --agree-tos \
    --non-interactive \
    || log "Certbot failed — fix DNS, then re-run certbot"
fi

cp infrastructure/hostinger/splaro-co-web.conf /etc/nginx/sites-available/splaro-web.conf
cp infrastructure/hostinger/splaro-co-admin.conf /etc/nginx/sites-available/splaro-admin.conf
cp infrastructure/hostinger/splaro-co-api.conf /etc/nginx/sites-available/splaro-api.conf
rm -f /etc/nginx/sites-enabled/splaro-bootstrap.conf 2>/dev/null || true
ln -sf /etc/nginx/sites-available/splaro-web.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/splaro-admin.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/splaro-api.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

if [ -d "/etc/letsencrypt/live/splaro.co" ]; then
  nginx -t && systemctl reload nginx
else
  log "SSL missing — keeping HTTP bootstrap until certbot succeeds"
  cp infrastructure/vps/nginx-http-bootstrap.conf /etc/nginx/sites-available/splaro-bootstrap.conf
  ln -sf /etc/nginx/sites-available/splaro-bootstrap.conf /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/splaro-web.conf /etc/nginx/sites-enabled/splaro-admin.conf /etc/nginx/sites-enabled/splaro-api.conf
  nginx -t && systemctl reload nginx
fi

pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ── Backup cron ──────────────────────────────────────────────
CRON_LINE="0 2 * * * bash $APP_DIR/infrastructure/scripts/backup-db.sh"
(crontab -l 2>/dev/null | grep -F "backup-db.sh" || echo "$CRON_LINE") | crontab -

# ── Health ───────────────────────────────────────────────────
sleep 8
WEB="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)"
ADMIN="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ || echo 000)"
API="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/v1/health || echo 000)"

log "Local health — web:$WEB admin:$ADMIN api:$API"
pm2 status

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Go-live complete                                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Store:  https://splaro.co                               ║"
echo "║  Admin:  https://admin.splaro.co/login                   ║"
echo "║  API:    https://splaro.co/api/v1/health                 ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Admin login: splaro.bd@gmail.com                        ║"
echo "║  Token: Telegram @splaro_bot → /login                    ║"
echo "╚══════════════════════════════════════════════════════════╝"

[ "$WEB" = "200" ] && [ "$ADMIN" = "200" ] && [ "$API" = "200" ] || {
  log "Some services not healthy — check: pm2 logs"
  exit 1
}

# ── GitHub auto-deploy setup ─────────────────────────────────
if [ -f "$APP_DIR/infrastructure/vps/setup-github-deploy.sh" ]; then
  log "Setting up GitHub auto-deploy..."
  bash "$APP_DIR/infrastructure/vps/setup-github-deploy.sh" || log "GitHub setup skipped — run manually"
fi
