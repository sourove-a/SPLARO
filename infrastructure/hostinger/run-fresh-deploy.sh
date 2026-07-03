#!/bin/bash
# Push to GitHub then run fresh-deploy on Hostinger via SSH
set -euo pipefail

SSH_HOST="${SSH_HOST:-145.79.25.203}"
SSH_PORT="${SSH_PORT:-65002}"
SSH_USER="${SSH_USER:-u134578371}"

if [ -z "${SSHPASS:-}" ]; then
  echo "export SSHPASS='your-hostinger-ssh-password'"
  exit 1
fi

command -v sshpass >/dev/null || { echo "brew install hudochenkov/sshpass/sshpass"; exit 1; }

echo "Running fresh deploy on ${SSH_USER}@${SSH_HOST}:${SSH_PORT} ..."
sshpass -e ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=30 \
  "${SSH_USER}@${SSH_HOST}" << 'REMOTE'
set -euo pipefail
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/pgenv/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
cd "$REPO"
git fetch origin main && git checkout main && git pull origin main
chmod +x infrastructure/hostinger/fresh-deploy-splaro-co.sh
bash infrastructure/hostinger/fresh-deploy-splaro-co.sh
REMOTE

echo ""
echo "Live checks:"
curl -sI --max-time 20 https://splaro.co | head -3
curl -sf --max-time 20 https://splaro.co/api/v1/health || echo "api proxy: pending"
curl -sI --max-time 20 https://admin.splaro.co/login | head -3
curl -sf --max-time 20 https://api.splaro.co/api/v1/health || echo "api.splaro.co: add subdomain in hPanel first"
