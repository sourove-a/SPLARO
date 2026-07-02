#!/bin/bash
# SPLARO — Hostinger Git deploy build (hPanel "Build command")
# hPanel MUST use Package manager: npm (not pnpm — corepack pnpm 11 crashes on Alt-NodeJS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[hostinger-build $(date '+%H:%M:%S')] $*"; }

log "Root=$ROOT Node=$(node -v)"

# Disable broken corepack pnpm 11.x → ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
bash "$ROOT/infrastructure/hostinger/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

log "Installing monorepo dependencies (pnpm $(pnpm --version))..."
pnpm install --frozen-lockfile

log "Building storefront (@splaro/web)..."
pnpm build:web

log "Preparing Next.js standalone bundle..."
node "$ROOT/scripts/prepare-next-standalone.mjs" apps/web

log "Build complete — start: node apps/web/.next/standalone/apps/web/server.js"
