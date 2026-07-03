#!/bin/bash
# Build SPLARO admin standalone on Hostinger (uses next.config.mjs — no turbopack TS load)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:${PNPM_HOME:-$HOME/.local/share/pnpm}:$PATH"
export SPLARO_HOSTINGER=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=2048"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-2}"
export NODE_ENV=production
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://splaro.co/api/v1}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_WEB_URL="${NEXT_PUBLIC_WEB_URL:-https://splaro.co}"

log() { echo "[build-admin $(date '+%H:%M:%S')] $*"; }

if [ -f "$ROOT/apps/admin/next.config.mjs" ] && [ -f "$ROOT/apps/admin/next.config.ts" ]; then
  mv "$ROOT/apps/admin/next.config.ts" "$ROOT/apps/admin/next.config.ts.hostinger-bak"
fi

NEXT_BIN=$(find "$ROOT/node_modules" -path '*/next/dist/bin/next' 2>/dev/null | head -1)
log "Building with $NEXT_BIN (webpack — turbopack disabled)"
(cd "$ROOT/apps/admin" && NEXT_DISABLE_TURBOPACK=1 node "$NEXT_BIN" build)

if [ -f "$ROOT/apps/admin/next.config.ts.hostinger-bak" ]; then
  mv "$ROOT/apps/admin/next.config.ts.hostinger-bak" "$ROOT/apps/admin/next.config.ts"
fi

node "$ROOT/scripts/prepare-next-standalone.mjs" apps/admin
log "Admin standalone: $ROOT/apps/admin/.next/standalone/apps/admin/server.js"
