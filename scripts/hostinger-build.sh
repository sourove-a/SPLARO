#!/bin/bash
# SPLARO — Hostinger Git deploy build (hPanel "Build command": npm run build)
# Web-only by default — admin/API via hpanel-recovery.sh after first deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[hostinger-build $(date '+%H:%M:%S')] $*"; }

# Hostinger Git checkout — build full stack + start services after build (no GitHub SSH)
if [[ "$ROOT" == *".builds/source/repository"* ]] || [[ -d "${HOME:-}/domains/splaro.co" ]]; then
  export SPLARO_BUILD_ADMIN="${SPLARO_BUILD_ADMIN:-1}"
  export SPLARO_BUILD_API="${SPLARO_BUILD_API:-1}"
  log "Hostinger server detected — full stack build enabled"
fi

log "Root=$ROOT Node=$(node -v)"

export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.splaro.co/api/v1}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_STORE_ID="${NEXT_PUBLIC_STORE_ID:-splaro}"
export NEXT_PUBLIC_CDN_URL="${NEXT_PUBLIC_CDN_URL:-https://splaro.co}"
export SPLARO_HOSTINGER=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072"
export NEXT_TELEMETRY_DISABLED=1
export CI=1

bash "$ROOT/infrastructure/hostinger/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"

# Skip heavy install if deps already present (redeploy)
if [ -d node_modules/.pnpm ] && [ -f pnpm-lock.yaml ]; then
  log "node_modules present — skip pnpm install"
else
  log "Installing dependencies (pnpm $(pnpm --version))..."
  SKIP_SPLARO_POSTINSTALL=1 NODE_ENV=development \
    pnpm install --frozen-lockfile --prod=false --ignore-scripts
fi

find "$ROOT/node_modules" -type f \( \
  -path '*/next/dist/bin/next' -o -path '*/.bin/*' \
\) -exec chmod +x {} + 2>/dev/null || true

NEXT_BIN=$(find "$ROOT/node_modules" -path '*/next/dist/bin/next' 2>/dev/null | head -1)
[ -n "$NEXT_BIN" ] || { log "ERROR: next binary not found"; exit 1; }
log "Next.js: $NEXT_BIN"

export NODE_ENV=production

# Force next.config.mjs (TS config causes turbopack panic on shared hosting)
WEB_TS="$ROOT/apps/web/next.config.ts"
WEB_TS_BAK="$ROOT/apps/web/next.config.ts.hostinger-bak"
if [ -f "$ROOT/apps/web/next.config.mjs" ] && [ -f "$WEB_TS" ]; then
  mv "$WEB_TS" "$WEB_TS_BAK"
  log "Using apps/web/next.config.mjs"
fi

log "Building storefront (@splaro/web)..."
rm -rf "$ROOT/apps/web/.next"
(cd "$ROOT/apps/web" && NEXT_DISABLE_TURBOPACK=1 node "$NEXT_BIN" build)

[ -f "$WEB_TS_BAK" ] && mv "$WEB_TS_BAK" "$WEB_TS"

node "$ROOT/scripts/prepare-next-standalone.mjs" apps/web

STANDALONE="$ROOT/apps/web/.next/standalone/apps/web/server.js"
[ -f "$STANDALONE" ] || { log "ERROR: missing $STANDALONE"; exit 1; }
log "Build OK — $STANDALONE"

# Optional full stack (off by default — run hpanel-recovery.sh for admin+API)
if [ "${SPLARO_BUILD_ADMIN:-0}" = "1" ]; then
  log "Building admin..."
  ADMIN_TS="$ROOT/apps/admin/next.config.ts"
  ADMIN_TS_BAK="$ROOT/apps/admin/next.config.ts.hostinger-bak"
  [ -f "$ROOT/apps/admin/next.config.mjs" ] && [ -f "$ADMIN_TS" ] && mv "$ADMIN_TS" "$ADMIN_TS_BAK"
  rm -rf "$ROOT/apps/admin/.next"
  (cd "$ROOT/apps/admin" && NEXT_DISABLE_TURBOPACK=1 node "$NEXT_BIN" build) || log "Admin build failed (non-fatal)"
  [ -f "$ADMIN_TS_BAK" ] && mv "$ADMIN_TS_BAK" "$ADMIN_TS"
  node "$ROOT/scripts/prepare-next-standalone.mjs" apps/admin 2>/dev/null || true
fi

if [ "${SPLARO_BUILD_API:-0}" = "1" ]; then
  log "Building API..."
  pnpm --filter @splaro/config run build 2>/dev/null || true
  pnpm --filter @splaro/types run build 2>/dev/null || true
  pnpm --filter @splaro/api run build 2>/dev/null || true
fi

rm -rf "$ROOT/dist"
ln -sfn apps/web/.next/standalone/apps/web "$ROOT/dist"
log "Linked dist → apps/web/.next/standalone/apps/web"

echo "$(date -Iseconds)" > "$ROOT/.hostinger-build-done"
log "Done — npm start to run storefront"

POST_DEPLOY="$ROOT/infrastructure/hostinger/post-git-deploy.sh"
if [[ "$ROOT" == *".builds/source/repository"* ]] && { [ -x "$POST_DEPLOY" ] || [ -f "$POST_DEPLOY" ]; }; then
  log "Scheduling post-git-deploy (web + admin + API) in background…"
  mkdir -p "$HOME/domains/splaro.co/nodejs" 2>/dev/null || true
  chmod +x "$POST_DEPLOY" 2>/dev/null || true
  nohup bash "$POST_DEPLOY" >> "${HOME}/domains/splaro.co/nodejs/post-git-deploy.log" 2>&1 &
fi
