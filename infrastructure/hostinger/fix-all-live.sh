#!/bin/bash
# SPLARO full live recovery — delegates to complete-production.sh
set -euo pipefail

export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"

echo "=== SPLARO Hostinger go-live ==="
cd "$REPO" || { echo "Repo missing"; exit 1; }
git pull origin main
bash infrastructure/hostinger/apply-hostinger-mysql-env.sh || true
bash infrastructure/hostinger/complete-production.sh
echo "Store:  https://splaro.co"
echo "Admin:  https://admin.splaro.co/login"
echo "API:    https://api.splaro.co/api/v1/health"
