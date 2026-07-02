#!/bin/bash
# SPLARO — Hostinger Git deploy build (hPanel "Build command")
# hPanel MUST use Package manager: npm (not pnpm — corepack pnpm 11 crashes on Alt-NodeJS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[hostinger-build $(date '+%H:%M:%S')] $*"; }

log "Root=$ROOT Node=$(node -v) PWD=$PWD"

# Next.js public env (do NOT set NODE_ENV=production before pnpm install — skips devDeps)
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.splaro.co/api/v1}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_STORE_ID="${NEXT_PUBLIC_STORE_ID:-splaro}"
export NEXT_PUBLIC_CDN_URL="${NEXT_PUBLIC_CDN_URL:-https://splaro.co}"

# Disable broken corepack pnpm 11.x → ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
log "Ensuring pnpm 9.x..."
bash "$ROOT/infrastructure/hostinger/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

log "Installing monorepo dependencies (pnpm $(pnpm --version))..."
log "NOTE: --prod=false keeps devDeps (tailwind, typescript); --ignore-scripts skips prisma postinstall"
# Prevent recursive root postinstall while pnpm install runs
SKIP_SPLARO_POSTINSTALL=1 NODE_ENV=development pnpm install --frozen-lockfile --prod=false --ignore-scripts

export NODE_ENV=production

log "Building storefront (@splaro/web)..."
pnpm build:web

log "Preparing Next.js standalone bundle..."
node "$ROOT/scripts/prepare-next-standalone.mjs" apps/web

STANDALONE="$ROOT/apps/web/.next/standalone/apps/web/server.js"
if [ ! -f "$STANDALONE" ]; then
  log "ERROR: standalone server missing at $STANDALONE"
  exit 1
fi

log "Build OK — standalone: $STANDALONE"

# Hostinger Express preset often expects ./dist — symlink for compatibility
DIST_LINK="$ROOT/dist"
rm -rf "$DIST_LINK"
ln -sfn apps/web/.next/standalone/apps/web "$DIST_LINK"
log "Linked dist → apps/web/.next/standalone/apps/web"

log "Start: npm start  OR  node apps/web/.next/standalone/apps/web/server.js"
