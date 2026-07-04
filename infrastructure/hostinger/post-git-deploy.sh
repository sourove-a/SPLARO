#!/bin/bash
# Runs on Hostinger after `npm run build` (Git auto-deploy). No SSH from GitHub needed.
# Starts web + admin + API + Passenger proxies in background (build step must finish first).
set +e
export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"

REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"
LOG="$HOME/domains/splaro.co/nodejs/post-git-deploy.log"
mkdir -p "$(dirname "$LOG")"

log() { echo "[post-git-deploy $(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# Only on Hostinger Git checkout
if [[ ! -d "$REPO/.git" ]] || [[ "$REPO" != *".builds/source/repository"* ]]; then
  exit 0
fi

exec 9>"$HOME/.splaro-post-git-deploy.lock"
flock -n 9 || { log "Already running — skip"; exit 0; }

log "Starting full stack after Git deploy…"
cd "$REPO" || exit 1

if [ -f "$REPO/infrastructure/hostinger/splaro-start-services.sh" ]; then
  bash "$REPO/infrastructure/hostinger/splaro-start-services.sh" >> "$LOG" 2>&1
elif [ -f "$REPO/infrastructure/hostinger/complete-production.sh" ]; then
  bash "$REPO/infrastructure/hostinger/complete-production.sh" >> "$LOG" 2>&1
else
  log "WARN: no start script found"
  exit 1
fi

log "Done — check https://splaro.co"
