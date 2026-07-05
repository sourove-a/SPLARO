#!/bin/bash
# SPLARO VPS — GitHub auto-deploy setup
# Creates deploy SSH key for GitHub Actions + git deploy key for repo pull.
#
# Run once on VPS as root:
#   bash /opt/splaro/app/infrastructure/vps/setup-github-deploy.sh
#
# Then add secrets to GitHub repo (Settings → Secrets → Actions):
#   VPS_HOST, VPS_USER, VPS_SSH_KEY

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/opt/splaro/app}"
DEPLOY_USER="${SPLARO_DEPLOY_USER:-root}"
REPO="${SPLARO_REPO:-sourove-a/SPLARO}"
KEY_DIR="$([ "$DEPLOY_USER" = "root" ] && echo /root/.ssh || echo /home/$DEPLOY_USER/.ssh)"
ACTIONS_KEY="$KEY_DIR/github_actions"
GIT_KEY="$KEY_DIR/github_deploy"

log() { echo "[github-setup] $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

mkdir -p "$KEY_DIR" "$APP_DIR" /var/log/splaro /opt/splaro
[ "$DEPLOY_USER" = "root" ] || { id "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"; chown -R "$DEPLOY_USER:$DEPLOY_USER" "$KEY_DIR"; }

# ── 1. GitHub Actions SSH key (Actions → VPS) ─────────────────
if [ ! -f "$ACTIONS_KEY" ]; then
  log "Generating GitHub Actions deploy key..."
  ssh-keygen -t ed25519 -f "$ACTIONS_KEY" -N "" -C "splaro-github-actions"
  [ "$DEPLOY_USER" = "root" ] || chown "$DEPLOY_USER:$DEPLOY_USER" "$ACTIONS_KEY" "$ACTIONS_KEY.pub"
fi

touch "$KEY_DIR/authorized_keys"
grep -qF "$(cat "$ACTIONS_KEY.pub")" "$KEY_DIR/authorized_keys" 2>/dev/null || \
  cat "$ACTIONS_KEY.pub" >> "$KEY_DIR/authorized_keys"
chmod 600 "$KEY_DIR/authorized_keys"
[ "$DEPLOY_USER" = "root" ] || chown "$DEPLOY_USER:$DEPLOY_USER" "$KEY_DIR/authorized_keys"

# ── 2. Git deploy key (VPS → GitHub pull) ─────────────────────
if [ ! -f "$GIT_KEY" ]; then
  log "Generating git deploy key (repo read)..."
  ssh-keygen -t ed25519 -f "$GIT_KEY" -N "" -C "splaro-vps-git"
  [ "$DEPLOY_USER" = "root" ] || chown "$DEPLOY_USER:$DEPLOY_USER" "$GIT_KEY" "$GIT_KEY.pub"
fi

cat > "$KEY_DIR/config" <<EOF
Host github.com github.com-splaro
  HostName github.com
  User git
  IdentityFile $GIT_KEY
  StrictHostKeyChecking accept-new
EOF
chmod 600 "$KEY_DIR/config"
[ "$DEPLOY_USER" = "root" ] || chown "$DEPLOY_USER:$DEPLOY_USER" "$KEY_DIR/config"

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git remote set-url origin "git@github.com:${REPO}.git" 2>/dev/null || true
fi

# ── 3. Deploy script symlink ─────────────────────────────────
if [ -f "$APP_DIR/infrastructure/vps/deploy-opt.sh" ]; then
  cp "$APP_DIR/infrastructure/vps/deploy-opt.sh" /opt/splaro/deploy.sh
  chmod +x /opt/splaro/deploy.sh
fi

# ── Output instructions ──────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  GitHub Auto-Deploy — copy to github.com/sourove-a/SPLARO      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "=== A. Repo → Settings → Secrets and variables → Actions ==="
echo ""
echo "  VPS_HOST     = 194.238.24.155"
echo "  VPS_USER     = root"
echo "  VPS_SSH_KEY  = (paste private key below — full BEGIN/END block)"
echo ""
echo "--- VPS_SSH_KEY (copy all) ---"
cat "$ACTIONS_KEY"
echo "--- end private key ---"
echo ""
echo "=== B. Repo → Settings → Deploy keys → Add deploy key ==="
echo ""
echo "  Title: splaro-vps-read"
echo "  Allow write access: NO (read-only)"
echo "  Key:"
cat "$GIT_KEY.pub"
echo ""
echo "=== C. Test ==="
echo "  git push origin main  →  Actions tab → Deploy VPS"
echo ""
