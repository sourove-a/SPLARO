#!/bin/bash
# SPLARO — Hostinger Git deploy build (hPanel: npm run build)
# Builds web + admin + API, syncs .env from hPanel, DB migrate, Passenger proxies.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[hostinger-build $(date '+%H:%M:%S')] $*"; }

ON_HOSTINGER=0
if [[ "$ROOT" == *".builds/source/repository"* ]] || [[ -d "${HOME:-}/domains/splaro.co" ]]; then
  ON_HOSTINGER=1
  export SPLARO_BUILD_ADMIN="${SPLARO_BUILD_ADMIN:-1}"
  export SPLARO_BUILD_API="${SPLARO_BUILD_API:-1}"
  log "Hostinger Git deploy — full stack build"
  bash "$ROOT/infrastructure/hostinger/sync-hpanel-env.sh" "$ROOT"
  set -a && [ -f .env ] && source .env && set +a
fi

log "Root=$ROOT Node=$(node -v)"

export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://splaro.co}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://splaro.co/api/v1}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.splaro.co}"
export NEXT_PUBLIC_STORE_ID="${NEXT_PUBLIC_STORE_ID:-splaro}"
export NEXT_PUBLIC_CDN_URL="${NEXT_PUBLIC_CDN_URL:-https://splaro.co}"
export WEB_URL="${WEB_URL:-https://splaro.co}"
export ADMIN_URL="${ADMIN_URL:-https://admin.splaro.co}"
export SPLARO_HOSTINGER=1
export NEXT_TELEMETRY_DISABLED=1
export CI=1
export NODE_ENV=production

# CloudLinux NPROC counts THREADS: without affinity + pool limits the Rust/SWC
# workers spawn one thread per visible core (64) and the kernel kills the build
# ("thread caused non-unwinding panic"). Pin to 2 cores and shrink every pool.
LEAN=""
if [ "$ON_HOSTINGER" = "1" ]; then
  export NODE_OPTIONS="--v8-pool-size=1 --max-old-space-size=1536"
  export UV_THREADPOOL_SIZE=2
  command -v taskset >/dev/null 2>&1 && LEAN="taskset -c 0,1"
else
  export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072"
fi

bash "$ROOT/infrastructure/hostinger/ensure-pnpm.sh"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"

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

# Workspace packages resolve to dist/ — build them before any Next/API build
log "Building workspace packages (@splaro/config, @splaro/types)…"
$LEAN pnpm --filter @splaro/config run build 2>&1 | tail -2 || { log "ERROR: config build failed"; exit 1; }
$LEAN pnpm --filter @splaro/types run build 2>&1 | tail -2 || { log "ERROR: types build failed"; exit 1; }

# Database — PostgreSQL for SPLARO app (orders/admin). MySQL = phpMyAdmin only.
if [ "$ON_HOSTINGER" = "1" ]; then
  bash "$ROOT/infrastructure/hostinger/apply-hostinger-mysql-env.sh" 2>&1 | tail -8 || log "WARN: MySQL env skipped"
  set -a && [ -f .env ] && source .env && set +a
  if [ -z "${DATABASE_URL:-}" ]; then
    log "Installing PostgreSQL (SPLARO app database)…"
    timeout 420 bash "$ROOT/infrastructure/hostinger/setup-local-postgres.sh" 2>&1 | tail -15 \
      || log "WARN: PostgreSQL setup timed out — set DATABASE_URL in hPanel env and redeploy"
  else
    log "Database migrate + seed…"
    (cd "$ROOT/packages/database" && npx prisma generate 2>&1 | tail -3) || true
    (cd "$ROOT/packages/database" && npx prisma db push --accept-data-loss 2>&1 | tail -5) || log "WARN: db push failed"
    pnpm db:seed 2>&1 | tail -8 || log "WARN: seed failed"
  fi
  set -a && [ -f .env ] && source .env && set +a
elif [ -n "${DATABASE_URL:-}" ]; then
  log "Database migrate…"
  (cd "$ROOT/packages/database" && npx prisma generate 2>&1 | tail -3) || true
  (cd "$ROOT/packages/database" && npx prisma db push --accept-data-loss 2>&1 | tail -5) || true
fi

# Force next.config.mjs on shared hosting
WEB_TS="$ROOT/apps/web/next.config.ts"
WEB_TS_BAK="$ROOT/apps/web/next.config.ts.hostinger-bak"
if [ -f "$ROOT/apps/web/next.config.mjs" ] && [ -f "$WEB_TS" ]; then
  mv "$WEB_TS" "$WEB_TS_BAK"
  log "Using apps/web/next.config.mjs"
fi

log "Building storefront (@splaro/web)…"
rm -rf "$ROOT/apps/web/.next"
(cd "$ROOT/apps/web" && NEXT_DISABLE_TURBOPACK=1 $LEAN node "$NEXT_BIN" build)
[ -f "$WEB_TS_BAK" ] && mv "$WEB_TS_BAK" "$WEB_TS"
node "$ROOT/scripts/prepare-next-standalone.mjs" apps/web

STANDALONE="$ROOT/apps/web/.next/standalone/apps/web/server.js"
[ -f "$STANDALONE" ] || { log "ERROR: missing $STANDALONE"; exit 1; }
log "Web build OK"

if [ "${SPLARO_BUILD_ADMIN:-0}" = "1" ]; then
  log "Building admin…"
  ADMIN_TS="$ROOT/apps/admin/next.config.ts"
  ADMIN_TS_BAK="$ROOT/apps/admin/next.config.ts.hostinger-bak"
  [ -f "$ROOT/apps/admin/next.config.mjs" ] && [ -f "$ADMIN_TS" ] && mv "$ADMIN_TS" "$ADMIN_TS_BAK"
  rm -rf "$ROOT/apps/admin/.next"
  (cd "$ROOT/apps/admin" && NEXT_DISABLE_TURBOPACK=1 $LEAN node "$NEXT_BIN" build) || { log "ERROR: admin build failed"; exit 1; }
  [ -f "$ADMIN_TS_BAK" ] && mv "$ADMIN_TS_BAK" "$ADMIN_TS"
  node "$ROOT/scripts/prepare-next-standalone.mjs" apps/admin 2>/dev/null || true
  log "Admin build OK"
fi

if [ "${SPLARO_BUILD_API:-0}" = "1" ]; then
  log "Building API…"
  pnpm --filter @splaro/config run build 2>/dev/null || true
  pnpm --filter @splaro/types run build 2>/dev/null || true
  NODE_OPTIONS="--v8-pool-size=1 --max-old-space-size=2560" \
    $LEAN pnpm --filter @splaro/api run build || { log "ERROR: API build failed"; exit 1; }
  [ -f "$ROOT/apps/api/dist/main.js" ] || { log "ERROR: missing apps/api/dist/main.js"; exit 1; }
  log "API build OK"
fi

rm -rf "$ROOT/dist"
ln -sfn apps/web/.next/standalone/apps/web "$ROOT/dist"
log "Linked dist → web standalone"

if [ "$ON_HOSTINGER" = "1" ]; then
  bash "$ROOT/infrastructure/hostinger/install-passenger-main.sh" 2>&1 | tail -5 || log "WARN: main passenger install skipped"
  bash "$ROOT/infrastructure/hostinger/install-passenger-proxies.sh" 2>&1 | tail -5 || true
  bash "$ROOT/infrastructure/hostinger/splaro-start-services.sh" 2>&1 | tail -12 || log "WARN: splaro-start-services skipped"
  if [ -n "${DATABASE_URL:-}" ] && [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_ADMIN_USER_ID:-}" ]; then
    TELEGRAM_STORE_SLUG="${TELEGRAM_STORE_SLUG:-splaro}" \
      pnpm telegram:configure 2>&1 | tail -5 || log "WARN: telegram configure skipped"
  fi
fi

echo "$(date -Iseconds)" > "$ROOT/.hostinger-build-done"
log "Done — hPanel runs: npm start"
