#!/bin/bash
# Run SPLARO deploy on Hostinger from your Mac (after SSH is enabled in hPanel)
#
# 1. hPanel → Advanced → SSH Access → Enable
# 2. Whitelist your IP if prompted
# 3. export SSHPASS='your-ssh-password'
# 4. bash infrastructure/hostinger/run-from-mac.sh

set -euo pipefail

SSH_HOST="${SSH_HOST:-145.79.25.203}"
SSH_PORT="${SSH_PORT:-65002}"
SSH_USER="${SSH_USER:-u134578371}"

if [ -z "${SSHPASS:-}" ]; then
  echo "Set SSHPASS first: export SSHPASS='your-password'"
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "Install sshpass: brew install hudochenkov/sshpass/sshpass"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE_SCRIPT="/tmp/splaro-deploy-remote.sh"

echo "Uploading deploy script..."
sshpass -e scp -P "$SSH_PORT" -o StrictHostKeyChecking=no \
  "$ROOT/infrastructure/hostinger/deploy-remote.sh" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_SCRIPT}"

echo "Running remote deploy (may take 10–20 min)..."
sshpass -e ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no \
  "${SSH_USER}@${SSH_HOST}" \
  "chmod +x ${REMOTE_SCRIPT} && SPLARO_DOMAIN=splaro.co bash ${REMOTE_SCRIPT}"

echo ""
echo "Live checks:"
curl -sI --max-time 20 "https://splaro.co" | head -5
curl -sI --max-time 20 "https://api.splaro.co/api/v1/health" | head -5
curl -sI --max-time 20 "https://admin.splaro.co" | head -5
