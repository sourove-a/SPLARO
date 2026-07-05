#!/bin/bash
# SPLARO — Mac-side VPS deploy prep
# Generates production .env, optional local build test, prints go-live steps.
#
# Usage:
#   bash infrastructure/vps/prep-from-mac.sh
#   bash infrastructure/vps/prep-from-mac.sh --build    # also run pnpm build:all
#   bash infrastructure/vps/prep-from-mac.sh --deploy     # SSH upload + go-live on VPS

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_OUT="$ROOT/infrastructure/vps/.env.production.generated"
DOMAIN="${SPLARO_DOMAIN:-splaro.co}"
VPS_IP="${VPS_IP:-}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
DO_BUILD=false
DO_DEPLOY=false

for arg in "$@"; do
  case "$arg" in
    --build) DO_BUILD=true ;;
    --deploy) DO_DEPLOY=true ;;
    -h|--help)
      echo "Usage: bash infrastructure/vps/prep-from-mac.sh [--build] [--deploy]"
      echo "  --build   Run pnpm build:all locally before deploy"
      echo "  --deploy  SSH to VPS and run go-live.sh (needs VPS_IP, SSH key)"
      exit 0
      ;;
  esac
done

log() { echo "[prep] $*"; }
die() { echo "[prep] ERROR: $*" >&2; exit 1; }

cd "$ROOT"

log "=== SPLARO VPS Prep ==="
log "Domain: $DOMAIN"

# ── Local checks ─────────────────────────────────────────────
command -v node >/dev/null || die "Node.js missing — install Node 20+"
command -v pnpm >/dev/null || die "pnpm missing — npm install -g pnpm"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
[ "$NODE_MAJOR" -ge 20 ] || die "Node 20+ required (found $(node -v))"

log "Node $(node -v) / pnpm $(pnpm --version) — OK"

# ── Generate production .env ─────────────────────────────────
log "Generating production secrets → infrastructure/vps/.env.production.generated"
bash "$ROOT/infrastructure/hostinger/generate-production-env.sh" > "$ENV_OUT"

# Append integration placeholders (user fills before go-live)
cat >> "$ENV_OUT" <<'EOF'

# ── INTEGRATIONS (fill before live traffic) ─────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_USER_ID=1997983081
TELEGRAM_STORE_SLUG=splaro
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=splaro_bot
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=
COURIER_DEV_STUB=false
AUTO_COURIER_BOOK=true
EOF

chmod 600 "$ENV_OUT"
log ".env generated (gitignored) — edit TELEGRAM + bKash + Steadfast keys"

# ── Optional local build ─────────────────────────────────────
if [ "$DO_BUILD" = true ]; then
  log "Running local production build (may take 5–10 min)..."
  export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
  pnpm install --frozen-lockfile
  pnpm build:all
  node scripts/prepare-next-standalone.mjs apps/web
  node scripts/prepare-next-standalone.mjs apps/admin
  log "Local build OK"
else
  log "Skipping build (add --build to test locally)"
fi

# ── DNS checklist ────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  DNS (hPanel / Cloudflare) — point to VPS IP             ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  A   @      →  YOUR_VPS_IP                               ║"
echo "║  A   www    →  YOUR_VPS_IP                               ║"
echo "║  A   admin  →  YOUR_VPS_IP                               ║"
echo "║  A   api    →  YOUR_VPS_IP  (optional — same as apex)    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── VPS go-live commands ─────────────────────────────────────
echo "=== VPS e run korun (root SSH) ==="
echo ""
echo "  ssh root@YOUR_VPS_IP"
echo "  git clone https://github.com/sourove-a/SPLARO.git /var/www/splaro"
echo "  # Mac theke .env upload:"
echo "  scp infrastructure/vps/.env.production.generated root@YOUR_VPS_IP:/var/www/splaro/.env"
echo "  bash /var/www/splaro/infrastructure/vps/go-live.sh"
echo ""
echo "=== Ba Mac theke ek command ==="
echo ""
echo "  VPS_IP=YOUR_IP bash infrastructure/vps/prep-from-mac.sh --deploy"
echo ""
echo "=== Verify ==="
echo ""
echo "  pnpm verify:production"
echo ""

# ── Optional remote deploy ───────────────────────────────────
if [ "$DO_DEPLOY" = true ]; then
  [ -n "$VPS_IP" ] || die "Set VPS_IP=your.server.ip"
  log "Deploying to $VPS_USER@$VPS_IP:$VPS_PORT ..."

  ssh -p "$VPS_PORT" -o ConnectTimeout=20 "${VPS_USER}@${VPS_IP}" "mkdir -p /var/www/splaro"
  scp -P "$VPS_PORT" "$ENV_OUT" "${VPS_USER}@${VPS_IP}:/var/www/splaro/.env"
  scp -P "$VPS_PORT" "$ROOT/infrastructure/vps/go-live.sh" \
    "${VPS_USER}@${VPS_IP}:/var/www/splaro/infrastructure/vps/go-live.sh" 2>/dev/null || {
    ssh -p "$VPS_PORT" "${VPS_USER}@${VPS_IP}" "mkdir -p /var/www/splaro/infrastructure/vps"
    scp -P "$VPS_PORT" "$ROOT/infrastructure/vps/go-live.sh" \
      "${VPS_USER}@${VPS_IP}:/var/www/splaro/infrastructure/vps/go-live.sh"
  }

  ssh -p "$VPS_PORT" "${VPS_USER}@${VPS_IP}" \
    "chmod +x /var/www/splaro/infrastructure/vps/go-live.sh && \
     SPLARO_DOMAIN=$DOMAIN bash /var/www/splaro/infrastructure/vps/go-live.sh"

  log "Remote go-live finished — running verify..."
  SPLARO_DOMAIN="$DOMAIN" node "$ROOT/scripts/verify-production.mjs" || true
fi

log "Prep complete."
