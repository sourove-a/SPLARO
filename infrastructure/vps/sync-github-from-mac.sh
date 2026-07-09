#!/bin/bash
# Mac-side: SSH to VPS, read deploy keys, push to GitHub Actions secrets + deploy key.
#
# Prereqs:
#   1. VPS bootstrap once: hpanel-bootstrap-github.sh (browser terminal)
#   2. gh auth login   (for automatic secret upload)
#
# Usage:
#   pnpm setup:github-deploy:sync
#   VPS_HOST=147.93.171.45 pnpm setup:github-deploy:sync

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-$(dig +short splaro.co A 2>/dev/null | head -1)}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
SSH_KEY="${SPLARO_SSH_KEY:-$HOME/.ssh/splaro_vps}"
REPO="${GITHUB_REPOSITORY:-sourove-a/SPLARO}"

log() { echo "[github-sync] $*"; }
die() { echo "[github-sync] ERROR: $*" >&2; exit 1; }

[ -n "$VPS_HOST" ] || die "Could not resolve splaro.co — set VPS_HOST=your.ip"
[ -f "$SSH_KEY" ] || die "Missing SSH key: $SSH_KEY"

SSH_OPTS=(-i "$SSH_KEY" -p "$VPS_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)

# Keep ~/.ssh/config splaro-vps alias current
if [ -f "$HOME/.ssh/config" ] && grep -q '^Host splaro-vps' "$HOME/.ssh/config" 2>/dev/null; then
  if grep -A3 '^Host splaro-vps' "$HOME/.ssh/config" | grep -q "HostName $VPS_HOST"; then
    :
  else
    log "Tip: update ~/.ssh/config Host splaro-vps → HostName $VPS_HOST"
  fi
fi

log "Testing SSH ${VPS_USER}@${VPS_HOST}:${VPS_PORT} ..."
if ! ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" 'echo SSH_OK'; then
  echo ""
  echo "SSH failed — run this ONCE in VPS browser terminal (Hostinger hPanel → VPS → Terminal):"
  echo ""
  echo "  curl -fsSL https://raw.githubusercontent.com/sourove-a/SPLARO/main/infrastructure/vps/hpanel-bootstrap-github.sh | bash"
  echo ""
  echo "Then re-run: pnpm setup:github-deploy:sync"
  exit 1
fi

log "Running setup-github-deploy.sh on VPS (idempotent)..."
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "bash /var/www/splaro/infrastructure/vps/setup-github-deploy.sh" >/dev/null

ACTIONS_KEY="$(ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" 'cat /root/.ssh/github_actions')"
GIT_DEPLOY_PUB="$(ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" 'cat /root/.ssh/github_deploy.pub')"

[ -n "$ACTIONS_KEY" ] || die "Empty github_actions key on VPS"
[ -n "$GIT_DEPLOY_PUB" ] || die "Empty github_deploy.pub on VPS"

if ! command -v gh >/dev/null 2>&1; then
  log "gh CLI not found — paste secrets manually (see below)"
  echo ""
  echo "VPS_HOST=$VPS_HOST"
  echo "VPS_USER=$VPS_USER"
  echo "--- VPS_SSH_KEY ---"
  echo "$ACTIONS_KEY"
  echo "--- deploy key (GitHub → Deploy keys) ---"
  echo "$GIT_DEPLOY_PUB"
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  die "Run: gh auth login   (then pnpm setup:github-deploy:sync)"
fi

log "Uploading GitHub Actions secrets..."
printf '%s' "$VPS_HOST" | gh secret set VPS_HOST --repo "$REPO"
printf '%s' "$VPS_HOST" | gh secret set VPS_SSH_HOST --repo "$REPO"
printf '%s' "$VPS_USER" | gh secret set VPS_USER --repo "$REPO"
printf '%s' "$VPS_USER" | gh secret set VPS_SSH_USER --repo "$REPO"
printf '%s' "$VPS_PORT" | gh secret set VPS_PORT --repo "$REPO"
printf '%s' "$VPS_PORT" | gh secret set VPS_SSH_PORT --repo "$REPO"
printf '%s' "$ACTIONS_KEY" | gh secret set VPS_SSH_KEY --repo "$REPO"
printf '%s' "$ACTIONS_KEY" | gh secret set VPS_SSH_PRIVATE_KEY --repo "$REPO"

log "Registering VPS git deploy key (read-only)..."
EXISTING="$(gh api "repos/${REPO}/keys" --jq '.[].title' 2>/dev/null || true)"
if echo "$EXISTING" | grep -qx 'splaro-vps-read'; then
  log "Deploy key splaro-vps-read already exists — skipping"
else
  gh api --method POST "repos/${REPO}/keys" \
    -f title='splaro-vps-read' \
    -f key="$GIT_DEPLOY_PUB" \
    -F read_only=true
  log "Deploy key added"
fi

log "Testing SSH with Actions key fingerprint..."
ssh -i <(printf '%s' "$ACTIONS_KEY") -p "$VPS_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  "${VPS_USER}@${VPS_HOST}" 'test -x /opt/splaro/deploy.sh && echo deploy_script_ok'

log "Done. Trigger: gh workflow run deploy-vps.yml --repo $REPO"
echo "  or: git push origin main"
