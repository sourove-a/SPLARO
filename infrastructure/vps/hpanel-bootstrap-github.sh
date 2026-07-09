#!/bin/bash
# Run once on VPS as root (Hostinger/Contabo browser terminal):
#   curl -fsSL https://raw.githubusercontent.com/sourove-a/SPLARO/main/infrastructure/vps/hpanel-bootstrap-github.sh | bash
#
# Installs Mac SSH access + GitHub Actions deploy keys + prints secrets to paste.

set -euo pipefail

REPO_RAW="${SPLARO_REPO_RAW:-https://raw.githubusercontent.com/sourove-a/SPLARO/main}"
APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
REPO_URL="${SPLARO_REPO:-https://github.com/sourove-a/SPLARO.git}"
BRANCH="${SPLARO_BRANCH:-main}"

log() { echo "[bootstrap] $*"; }
die() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root"

mkdir -p /root/.ssh /opt/splaro /var/log/splaro "$APP_DIR"
chmod 700 /root/.ssh

log "Authorizing Mac deploy key..."
MAC_PUB="$(curl -fsSL "$REPO_RAW/infrastructure/vps/authorized-keys/splaro-mac.pub")"
touch /root/.ssh/authorized_keys
if ! grep -qF "$MAC_PUB" /root/.ssh/authorized_keys 2>/dev/null; then
  echo "$MAC_PUB" >> /root/.ssh/authorized_keys
fi
chmod 600 /root/.ssh/authorized_keys

if [ ! -d "$APP_DIR/.git" ]; then
  log "Cloning $REPO_URL → $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
log "Syncing $BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

SETUP="$APP_DIR/infrastructure/vps/setup-github-deploy.sh"
[ -f "$SETUP" ] || die "Missing $SETUP"
bash "$SETUP" | tee /var/log/splaro/github-setup.log

VPS_IP="$(dig +short splaro.co A 2>/dev/null | head -1 || hostname -I | awk '{print $1}')"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  GitHub → sourove-a/SPLARO → Settings → Secrets → Actions   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  VPS_HOST            = ${VPS_IP}"
echo "  VPS_SSH_HOST        = ${VPS_IP}   (alias — workflow accepts both)"
echo "  VPS_USER            = root"
echo "  VPS_SSH_USER        = root"
echo "  VPS_PORT            = 22"
echo "  VPS_SSH_PORT        = 22"
echo ""
echo "  VPS_SSH_KEY         = paste private key below (full block)"
echo "  VPS_SSH_PRIVATE_KEY = same private key (alias)"
echo ""
echo "---------- BEGIN VPS_SSH_KEY (copy all lines) ----------"
cat /root/.ssh/github_actions
echo "---------- END VPS_SSH_KEY ----------"
echo ""
echo "Deploy key (GitHub → Settings → Deploy keys → Add, read-only):"
cat /root/.ssh/github_deploy.pub
echo ""
echo "Done. Mac: pnpm setup:github-deploy:sync  |  Test: git push → Actions → Deploy VPS"
