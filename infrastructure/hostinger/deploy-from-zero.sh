#!/bin/bash
# Push to GitHub + bootstrap Hostinger from empty state
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${SSH_HOST:-145.79.25.203}"
SSH_PORT="${SSH_PORT:-65002}"
SSH_USER="${SSH_USER:-u134578371}"

cd "$ROOT"

echo "=== 1. Push to GitHub ==="
git push origin main

echo ""
echo "=== 2. Wait for hPanel Git deploy (30s) ==="
sleep 30

[ -n "${SSHPASS:-}" ] || { echo "export SSHPASS='your-ssh-password'"; exit 1; }
command -v sshpass >/dev/null || die "brew install hudochenkov/sshpass/sshpass"

echo "=== 3. Bootstrap on server ==="
sshpass -e ssh -T -p "$SSH_PORT" -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" \
  'export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$PATH"; bash -s' \
  < "$ROOT/infrastructure/hostinger/bootstrap-from-zero.sh"

echo ""
echo "=== 4. Live check ==="
curl -sf --max-time 20 https://splaro.co/api/v1/health && echo || echo "splaro.co: pending"
curl -sI --max-time 20 https://admin.splaro.co/login | head -3
curl -sf --max-time 20 https://api.splaro.co/api/v1/health && echo || echo "api.splaro.co: add subdomain in hPanel"
