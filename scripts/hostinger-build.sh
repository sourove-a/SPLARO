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
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://splaro.co/api/v1}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_STORE_ID="${NEXT_PUBLIC_STORE_ID:-splaro}"
export NEXT_PUBLIC_CDN_URL="${NEXT_PUBLIC_CDN_URL:-https://splaro.co}"

# Disable broken corepack pnpm 11.x → ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
log "Ensuring pnpm 9.x..."
bash "$ROOT/infrastructure/hostinger/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
export SPLARO_HOSTINGER=1
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-2}"

log "Installing monorepo dependencies (pnpm $(pnpm --version))..."
log "NOTE: --prod=false keeps devDeps (tailwind, typescript); --ignore-scripts skips prisma postinstall"
SKIP_SPLARO_POSTINSTALL=1 NODE_ENV=development pnpm install --frozen-lockfile --prod=false --ignore-scripts

log "Fixing binary permissions (Hostinger EACCES on turbo/prisma/next)..."
find "$ROOT/node_modules" -type f \( \
  -path '*/@turbo/linux-64/bin/turbo' \
  -o -path '*/prisma/build/index.js' \
  -o -path '*/next/dist/bin/next' \
  -o -path '*/.bin/*' \
\) -exec chmod +x {} + 2>/dev/null || true

log "Generating Prisma client for workspace packages..."
if [ -n "${DATABASE_URL:-}" ]; then
  SKIP_SPLARO_POSTINSTALL=1 pnpm db:generate
else
  log "DATABASE_URL unset — skip prisma generate (OK for storefront-only Git build)"
fi

export NODE_ENV=production

log "Building storefront (@splaro/web)..."
# Use next.config.mjs on shared hosting (avoids TS/turbopack config load thread errors)
if [ -f "$ROOT/apps/web/next.config.mjs" ] && [ -f "$ROOT/apps/web/next.config.ts" ]; then
  mv "$ROOT/apps/web/next.config.ts" "$ROOT/apps/web/next.config.ts.hostinger-bak"
  log "Using next.config.mjs for Hostinger build"
fi
# Direct pnpm filter avoids turbo spawn EACCES on shared hosting
pnpm --filter @splaro/web run build
if [ -f "$ROOT/apps/web/next.config.ts.hostinger-bak" ]; then
  mv "$ROOT/apps/web/next.config.ts.hostinger-bak" "$ROOT/apps/web/next.config.ts"
fi

log "Preparing Next.js standalone bundle..."
node "$ROOT/scripts/prepare-next-standalone.mjs" apps/web

STANDALONE="$ROOT/apps/web/.next/standalone/apps/web/server.js"
if [ ! -f "$STANDALONE" ]; then
  log "ERROR: standalone server missing at $STANDALONE"
  exit 1
fi

log "Build OK — standalone: $STANDALONE"

# Optional: SPLARO_BUILD_ADMIN=1 to also build admin panel on same server
if [ "${SPLARO_BUILD_ADMIN:-0}" = "1" ]; then
  log "Building admin (@splaro/admin)..."
  if [ -f "$ROOT/apps/admin/next.config.mjs" ] && [ -f "$ROOT/apps/admin/next.config.ts" ]; then
    mv "$ROOT/apps/admin/next.config.ts" "$ROOT/apps/admin/next.config.ts.hostinger-bak"
  fi
  NEXT_BIN=$(find "$ROOT/node_modules" -path '*/next/dist/bin/next' 2>/dev/null | head -1)
  (cd "$ROOT/apps/admin" && node "$NEXT_BIN" build) || log "Admin build failed — deploy web only"
  if [ -f "$ROOT/apps/admin/next.config.ts.hostinger-bak" ]; then
    mv "$ROOT/apps/admin/next.config.ts.hostinger-bak" "$ROOT/apps/admin/next.config.ts"
  fi
  node "$ROOT/scripts/prepare-next-standalone.mjs" apps/admin 2>/dev/null || true
fi

# Hostinger Express preset often expects ./dist — symlink for compatibility
DIST_LINK="$ROOT/dist"
rm -rf "$DIST_LINK"
ln -sfn apps/web/.next/standalone/apps/web "$DIST_LINK"
log "Linked dist → apps/web/.next/standalone/apps/web"

log "Start: npm start  OR  node apps/web/.next/standalone/apps/web/server.js"

# Post-build: apply Passenger stack + env fixes (API + web proxy)
if [ -f "$ROOT/infrastructure/hostinger/fix-all-production.sh" ]; then
  log "Running fix-all-production.sh..."
  bash "$ROOT/infrastructure/hostinger/fix-all-production.sh" || log "fix-all warning (non-fatal)"
elif [ -f "$ROOT/infrastructure/hostinger/fix-production.sh" ]; then
  bash "$ROOT/infrastructure/hostinger/fix-production.sh" || true
fi
