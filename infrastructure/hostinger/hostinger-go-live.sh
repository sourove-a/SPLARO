#!/bin/bash
# SPLARO go-live on Hostinger — paste in hPanel → Advanced → SSH Access → Browser terminal
# MySQL (u134578371_SPLARO) is created in hPanel but SPLARO API uses PostgreSQL on the same account.
set -euo pipefail

export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"

echo "=== SPLARO Hostinger go-live ==="
echo "MySQL u134578371_SPLARO: OK in hPanel (SPLARO does not use MySQL)"
echo "PostgreSQL: installing on this Hostinger account..."
echo ""

cd "$REPO" || { echo "Repo missing — redeploy from GitHub first"; exit 1; }
git pull origin main

bash infrastructure/hostinger/apply-hostinger-mysql-env.sh
echo "MySQL env OK (phpMyAdmin) — SPLARO API still uses PostgreSQL (DATABASE_URL)"

bash infrastructure/hostinger/complete-production.sh
bash infrastructure/hostinger/verify-production.sh
echo "Store:  https://splaro.co"
echo "Admin:  https://admin.splaro.co/login"
echo "API:    https://api.splaro.co/api/v1/health"
echo "Admin email: splaro.bd@gmail.com (password in $REPO/.env ADMIN_PASSWORD)"
echo "phpMyAdmin: https://hpanel.hostinger.com/websites/splaro.co/databases/php-my-admin"
