#!/bin/bash
# ============================================================
# SPLARO — Fresh Hostinger VPS Setup Script
# Ubuntu 22.04 LTS
# Run as root: bash setup-server.sh
# ============================================================

set -euo pipefail

SPLARO_USER="splaro"
NODE_VERSION="20"
POSTGRES_VERSION="16"
REDIS_VERSION="7"
APP_DIR="/var/www/splaro"
LOG_DIR="/var/log/splaro"

echo "=========================================="
echo "  SPLARO VPS Setup — Ubuntu 22.04"
echo "=========================================="

# ── SYSTEM UPDATE ────────────────────────────────────────────
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git unzip build-essential software-properties-common \
    ca-certificates gnupg lsb-release ufw fail2ban htop jq

# ── NODE.JS ──────────────────────────────────────────────────
echo "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# ── PNPM ─────────────────────────────────────────────────────
echo "Installing PNPM..."
npm install -g pnpm pm2

# ── POSTGRESQL ───────────────────────────────────────────────
echo "Installing PostgreSQL $POSTGRES_VERSION..."
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update -y
apt-get install -y postgresql-$POSTGRES_VERSION

systemctl enable postgresql
systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER splaro_user WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE splaro_db OWNER splaro_user;
CREATE DATABASE splaro_shadow_db OWNER splaro_user;
GRANT ALL PRIVILEGES ON DATABASE splaro_db TO splaro_user;
GRANT ALL PRIVILEGES ON DATABASE splaro_shadow_db TO splaro_user;
EOF

# ── REDIS ────────────────────────────────────────────────────
echo "Installing Redis $REDIS_VERSION..."
curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list
apt-get update -y
apt-get install -y redis

systemctl enable redis-server
systemctl start redis-server

# ── NGINX ────────────────────────────────────────────────────
echo "Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# ── CERTBOT (Let's Encrypt SSL) ──────────────────────────────
echo "Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# ── PUPPETEER DEPENDENCIES ───────────────────────────────────
echo "Installing Puppeteer system dependencies..."
apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    fonts-liberation libappindicator3-1

# ── APP USER ─────────────────────────────────────────────────
echo "Creating app user: $SPLARO_USER..."
useradd -m -s /bin/bash "$SPLARO_USER" || true
usermod -aG sudo "$SPLARO_USER"

# ── DIRECTORIES ──────────────────────────────────────────────
mkdir -p "$APP_DIR" "$LOG_DIR"
chown -R "$SPLARO_USER":"$SPLARO_USER" "$APP_DIR" "$LOG_DIR"

# ── UFW FIREWALL ─────────────────────────────────────────────
echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── FAIL2BAN ─────────────────────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban

# ── PM2 STARTUP ──────────────────────────────────────────────
pm2 startup systemd -u "$SPLARO_USER" --hp "/home/$SPLARO_USER"

echo ""
echo "=========================================="
echo "  Server setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Set DATABASE_URL in /var/www/splaro/.env.local"
echo "2. Clone repo: git clone <repo> /var/www/splaro"
echo "3. Run: bash /var/www/splaro/infrastructure/scripts/deploy.sh"
echo "4. Get SSL: certbot --nginx -d splaro.com.bd -d www.splaro.com.bd -d api.splaro.com.bd -d admin.splaro.com.bd"
echo ""
