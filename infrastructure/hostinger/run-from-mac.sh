#!/bin/bash
# One-shot deploy from your Mac → Hostinger (needs SSH enabled in hPanel)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${SSH_HOST:-145.79.25.203}"
SSH_PORT="${SSH_PORT:-65002}"
SSH_USER="${SSH_USER:-u134578371}"

if [ -z "${SSHPASS:-}" ]; then
  echo "export SSHPASS='your-hostinger-ssh-password'"
  exit 1
fi

command -v sshpass >/dev/null || { echo "brew install hudochenkov/sshpass/sshpass"; exit 1; }

echo "Testing SSH ${SSH_USER}@${SSH_HOST}:${SSH_PORT} ..."
if ! sshpass -e ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=20 \
  "${SSH_USER}@${SSH_HOST}" 'echo SSH_OK && node -v 2>/dev/null || echo NO_NODE'; then
  echo ""
  echo "SSH failed. Fix in hPanel:"
  echo "  1. Advanced → SSH Access → Enable"
  echo "  2. Copy the IP shown there (may differ from ${SSH_HOST})"
  echo "  3. Try mobile hotspot if ISP blocks port ${SSH_PORT}"
  echo "  4. Or use hPanel Browser Terminal (no SSH from Mac):"
  echo "       cd ~/splaro && git pull && bash infrastructure/hostinger/deploy-remote.sh"
  echo "  5. Or GitHub Actions: add secrets + run Deploy Hostinger workflow"
  exit 1
fi

ENV_FILE="$(mktemp)"
bash "$ROOT/infrastructure/hostinger/generate-production-env.sh" > "$ENV_FILE"
echo "Uploading .env + deploy script..."

sshpass -e scp -P "$SSH_PORT" -o StrictHostKeyChecking=no \
  "$ENV_FILE" "${SSH_USER}@${SSH_HOST}:~/splaro.env"

sshpass -e scp -P "$SSH_PORT" -o StrictHostKeyChecking=no \
  "$ROOT/infrastructure/hostinger/deploy-remote.sh" \
  "$ROOT/infrastructure/hostinger/ensure-pnpm.sh" \
  "${SSH_USER}@${SSH_HOST}:/tmp/"

sshpass -e ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" << 'REMOTE'
set -euo pipefail
mkdir -p ~/splaro
mv ~/splaro.env ~/splaro/.env
chmod 600 ~/splaro/.env
export SPLARO_APP_DIR="$HOME/splaro"
export SPLARO_DOMAIN=splaro.co
bash /tmp/deploy-remote.sh
REMOTE

rm -f "$ENV_FILE"

echo ""
echo "Live checks:"
curl -sI --max-time 20 https://splaro.co | head -6
curl -sf --max-time 20 https://api.splaro.co/api/v1/health || echo "api: pending DNS/SSL"
curl -sI --max-time 20 https://admin.splaro.co | head -6
