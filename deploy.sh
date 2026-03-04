#!/usr/bin/env bash
# ============================================================
#  SPLARO — One-Command Deploy Script
#  Builds → GitHub Push → Hostinger Upload
# ============================================================
set -euo pipefail

# ------------ CONFIG (edit if needed) -----------------------
REMOTE_HOST="145.79.25.203"
REMOTE_PORT="65002"
REMOTE_USER="u134578371"
REMOTE_PASS="${SPLARO_SSH_PASS:-}"   # set via env or prompted below

GITHUB_BRANCH="${1:-main}"            # pass branch as arg, default: main
REMOTE_PUBLIC="/home/u134578371/domains/splaro.co/public_html"
REMOTE_ADMIN_MAIN="$REMOTE_PUBLIC/admin"
REMOTE_ADMIN_SUB="/home/u134578371/domains/admin.splaro.co/public_html"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# ------------------------------------------------------------

log()  { echo -e "\033[1;36m[deploy]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[  OK  ]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERROR ]\033[0m $*" >&2; exit 1; }

# ── 0. Require tools ─────────────────────────────────────────
for cmd in git npm node; do
  command -v "$cmd" >/dev/null 2>&1 || err "Missing required tool: $cmd"
done

# ── 1. Ask for SSH password if not set ───────────────────────
if [[ -z "$REMOTE_PASS" ]]; then
  echo -n "Enter Hostinger SSH password: "
  read -rs REMOTE_PASS
  echo
fi

SSH_CMD=""
if command -v sshpass >/dev/null 2>&1; then
  SSH_CMD="sshpass -p '$REMOTE_PASS' ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT"
  SCP_CMD="sshpass -p '$REMOTE_PASS' scp -o StrictHostKeyChecking=no -P $REMOTE_PORT"
  RSYNC_CMD="sshpass -p '$REMOTE_PASS' rsync -avz --delete -e 'ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT'"
else
  log "sshpass not found → using ssh (you may be prompted for password multiple times)"
  SSH_CMD="ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT"
  SCP_CMD="scp -o StrictHostKeyChecking=no -P $REMOTE_PORT"
  RSYNC_CMD="rsync -avz --delete -e 'ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT'"
fi

# ── 2. Git: commit any remaining changes & push ──────────────
log "Step 1/4 — Pushing code to GitHub ($GITHUB_BRANCH)..."
cd "$SCRIPT_DIR"

git add -A 2>/dev/null || true

if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "chore: deploy sync $(date '+%Y-%m-%d %H:%M')"
fi

# Push current branch first
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push origin "$CURRENT_BRANCH"

# If we're not already on main, merge to main and push
if [[ "$CURRENT_BRANCH" != "$GITHUB_BRANCH" ]]; then
  log "Merging $CURRENT_BRANCH → $GITHUB_BRANCH..."
  git checkout "$GITHUB_BRANCH"
  git merge "$CURRENT_BRANCH" --no-ff -m "Merge $CURRENT_BRANCH into $GITHUB_BRANCH"
  git push origin "$GITHUB_BRANCH"
  git checkout "$CURRENT_BRANCH"
fi

ok "GitHub push complete"

# ── 3. Build storefront & admin ──────────────────────────────
log "Step 2/4 — Building project..."
cd "$SCRIPT_DIR"
npm run build:storefront
bash scripts/prepare-public-html.sh
bash scripts/prepare-admin-public-html.sh 2>/dev/null || true
ok "Build complete"

# ── 4. Upload to Hostinger via rsync/scp ─────────────────────
log "Step 3/4 — Uploading to Hostinger..."

upload_rsync() {
  local src="$1"
  local dst="$2"
  local label="$3"
  log "Uploading $label..."
  if command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$REMOTE_PASS" rsync -avz --delete \
      --exclude='.env' --exclude='.env.local' --exclude='.env.production' \
      -e "ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT" \
      "$src/" "$REMOTE_USER@$REMOTE_HOST:$dst/"
  else
    rsync -avz --delete \
      --exclude='.env' --exclude='.env.local' --exclude='.env.production' \
      -e "ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT" \
      "$src/" "$REMOTE_USER@$REMOTE_HOST:$dst/"
  fi
  ok "$label uploaded"
}

# Upload main storefront
upload_rsync "$SCRIPT_DIR/public_html" "$REMOTE_PUBLIC" "storefront"

# Upload admin to main domain's admin folder
upload_rsync "$SCRIPT_DIR/public_html/admin" "$REMOTE_ADMIN_MAIN" "admin (main)"

# Upload admin to subdomain root (if it exists on server)
if command -v sshpass >/dev/null 2>&1; then
  SUB_EXISTS="$(sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT \
    $REMOTE_USER@$REMOTE_HOST "[ -d '$(dirname $REMOTE_ADMIN_SUB)' ] && echo yes || echo no" 2>/dev/null || echo no)"
else
  SUB_EXISTS="$(ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT \
    $REMOTE_USER@$REMOTE_HOST "[ -d '$(dirname $REMOTE_ADMIN_SUB)' ] && echo yes || echo no" 2>/dev/null || echo no)"
fi

if [[ "$SUB_EXISTS" == "yes" ]]; then
  upload_rsync "$SCRIPT_DIR/public_html/admin" "$REMOTE_ADMIN_SUB" "admin (subdomain)"
fi

# ── 5. Fix permissions on server ─────────────────────────────
log "Step 4/4 — Setting file permissions..."
if command -v sshpass >/dev/null 2>&1; then
  sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT \
    $REMOTE_USER@$REMOTE_HOST "
      find $REMOTE_PUBLIC -type d -exec chmod 755 {} \;
      find $REMOTE_PUBLIC -type f -exec chmod 644 {} \;
      echo 'Permissions set OK'
    "
else
  ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT \
    $REMOTE_USER@$REMOTE_HOST "
      find $REMOTE_PUBLIC -type d -exec chmod 755 {} \;
      find $REMOTE_PUBLIC -type f -exec chmod 644 {} \;
      echo 'Permissions set OK'
    "
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
ok "╔══════════════════════════════════════════╗"
ok "║  SPLARO Deploy Complete!                 ║"
ok "║  🌐  https://splaro.co                  ║"
ok "║  🔧  https://admin.splaro.co            ║"
ok "╚══════════════════════════════════════════╝"
