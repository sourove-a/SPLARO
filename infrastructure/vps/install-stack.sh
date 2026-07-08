#!/bin/bash
# SPLARO VPS — install everything (native stack, Docker optional for DB)
# Run as root on fresh Ubuntu 22.04+
#
# Usage:
#   bash infrastructure/vps/install-stack.sh           # native Postgres + Redis
#   USE_DOCKER_DB=true bash infrastructure/vps/install-stack.sh

set -euo pipefail

USE_DOCKER_DB="${USE_DOCKER_DB:-false}"
APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"

log() { echo "[install $(date '+%H:%M:%S')] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  SPLARO VPS Stack Install                                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Native (required):  Node 20, pnpm, PM2, Nginx, Certbot       ║"
echo "║  Database:           PostgreSQL 16 + Redis 7                 ║"
echo "║  Optional Docker:    USE_DOCKER_DB=true (Postgres+Redis)     ║"
echo "║  App runtime:        PM2 (web + admin + api + worker)        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Base packages ────────────────────────────────────────────
log "System packages..."
apt-get update -y
apt-get install -y curl wget git unzip build-essential ca-certificates \
  gnupg lsb-release ufw fail2ban htop jq nginx certbot python3-certbot-nginx

# ── Node.js 20 ───────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -p "process.versions.node.split('.')[0]")" -lt 20 ]; then
  log "Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "Node $(node -v)"

# ── pnpm + PM2 ───────────────────────────────────────────────
log "pnpm + PM2..."
npm install -g pnpm pm2
log "pnpm $(pnpm --version)"

# ── Database: Docker OR native ─────────────────────────────
if [ "$USE_DOCKER_DB" = "true" ]; then
  log "Docker (Postgres + Redis containers)..."
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
  fi
  apt-get install -y docker-compose-plugin 2>/dev/null || true
  mkdir -p "$APP_DIR"
  if [ -f "$APP_DIR/docker-compose.prod.yml" ]; then
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml up -d
    log "Docker DB started — set DATABASE_URL in .env"
  else
    log "Clone repo first, then: docker compose -f docker-compose.prod.yml up -d"
  fi
else
  # Native PostgreSQL
  if ! command -v psql >/dev/null 2>&1; then
    log "PostgreSQL 16..."
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    apt-get update -y
    apt-get install -y postgresql-16
    systemctl enable postgresql
    systemctl start postgresql
  fi

  # Native Redis
  if ! command -v redis-cli >/dev/null 2>&1; then
    log "Redis 7..."
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" \
      | tee /etc/apt/sources.list.d/redis.list
    apt-get update -y
    apt-get install -y redis
    systemctl enable redis-server
    systemctl start redis-server
  fi
fi

# ── Puppeteer deps (invoice/PDF) ─────────────────────────────
log "Puppeteer system libs..."
apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 fonts-liberation 2>/dev/null || true

# ── Directories ────────────────────────────────────────────────
mkdir -p "$APP_DIR" /var/log/splaro /var/backups/splaro /var/www/certbot
useradd -m -s /bin/bash splaro 2>/dev/null || true

# ── Firewall ─────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl enable fail2ban nginx
systemctl start fail2ban nginx

# ── Meilisearch (local search — localhost only) ──────────────
if [ "${INSTALL_MEILISEARCH:-true}" = "true" ] && [ -f "$APP_DIR/infrastructure/vps/setup-meilisearch.sh" ]; then
  log "Meilisearch..."
  bash "$APP_DIR/infrastructure/vps/setup-meilisearch.sh" || log "WARN: Meilisearch setup skipped — run manually"
elif [ "${INSTALL_MEILISEARCH:-true}" = "true" ]; then
  log "Clone repo first, then: bash infrastructure/vps/setup-meilisearch.sh"
fi

# ── Nginx performance (gzip + http2 site configs) ─────────────
if [ -f "$APP_DIR/infrastructure/vps/setup-nginx-performance.sh" ]; then
  bash "$APP_DIR/infrastructure/vps/setup-nginx-performance.sh" || log "WARN: nginx performance skipped"
fi

echo ""
log "Stack install complete."
echo ""
echo "Installed:"
echo "  ✓ Node $(node -v)  pnpm $(pnpm --version)  PM2"
echo "  ✓ Nginx + Certbot"
if [ "$USE_DOCKER_DB" = "true" ]; then
  echo "  ✓ Docker + Postgres + Redis (containers)"
else
  echo "  ✓ PostgreSQL + Redis (native)"
fi
echo "  ✓ Meilisearch (optional): bash infrastructure/vps/setup-meilisearch.sh"
echo ""
echo "Next:"
echo "  1. bash infrastructure/vps/go-live.sh"
echo "  2. bash infrastructure/vps/setup-github-deploy.sh"
