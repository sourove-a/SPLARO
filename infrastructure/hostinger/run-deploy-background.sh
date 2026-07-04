#!/bin/bash
# Paste in Hostinger SSH — survives disconnect (runs in background)
# Usage: curl -fsSL https://raw.githubusercontent.com/sourove-a/SPLARO/main/infrastructure/hostinger/run-deploy-background.sh | bash
set -euo pipefail
LOG="$HOME/splaro-deploy.log"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
(
  export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"
  export NODE_OPTIONS="--max-old-space-size=768"
  echo "=== deploy start $(date) ===" >> "$LOG"
  cd "$REPO" && git pull origin main >> "$LOG" 2>&1
  bash "$REPO/infrastructure/hostinger/ssh-fix-all.sh" >> "$LOG" 2>&1
  echo "=== deploy end $(date) ===" >> "$LOG"
) &
echo "Deploy started in background. Watch: tail -f $LOG"
