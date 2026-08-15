#!/bin/bash
# SPLARO VPS — redeploy (git pull → build → PM2 reload)
# Used by GitHub Actions auto-deploy and manual updates.
#
# Usage (on VPS):
#   bash /var/www/splaro/infrastructure/vps/deploy.sh

set -euo pipefail

APP_DIR="${SPLARO_APP_DIR:-/var/www/splaro}"
LOG_FILE="/var/log/splaro/deploy.log"
BRANCH="${SPLARO_BRANCH:-main}"
DEPLOY_SHA="${SPLARO_DEPLOY_SHA:-}"
REPO_SSH="${SPLARO_REPO_SSH:-git@github.com:sourove-a/SPLARO.git}"
DEPLOY_KEY="${SPLARO_DEPLOY_KEY:-/root/.ssh/github_deploy}"
DEPLOY_LOCK="${SPLARO_DEPLOY_LOCK:-/var/run/splaro-deploy.lock}"
RELEASE_SWITCHED=0
RELEASE_ROOT="${SPLARO_RELEASE_ROOT:-/var/www/splaro-releases}"
RELEASE_CANDIDATE=""
PREVIOUS_RELEASE="${RELEASE_ROOT}/previous"
TEMP_WEB_PID=""
TEMP_ADMIN_PID=""
NGINX_BACKUP_DIR=""
UPLOAD_SMOKE_FILE=""
NGINX_CONFIG_PATHS=(
  /etc/nginx/snippets/splaro-uploads.conf
  /etc/nginx/sites-available/splaro.co.conf
  /etc/nginx/sites-enabled/splaro.co.conf
  /etc/nginx/sites-available/splaro-web.conf
  /etc/nginx/sites-enabled/splaro-web.conf
  /etc/nginx/sites-available/splaro-admin.conf
  /etc/nginx/sites-enabled/splaro-admin.conf
  /etc/nginx/sites-available/splaro-api.conf
  /etc/nginx/sites-enabled/splaro-api.conf
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

# Keep deploy.lock mtime fresh so watchdog's age check never treats a long
# build as "stale" and starts PM2 mid-compile (admin MODULE_NOT_FOUND storm).
touch_deploy_lock() {
  echo "$$ $(date -Is)" >"$DEPLOY_LOCK"
}

backup_nginx_config() {
  NGINX_BACKUP_DIR="$(mktemp -d)"
  local config_path backup_path
  for config_path in "${NGINX_CONFIG_PATHS[@]}"; do
    backup_path="$NGINX_BACKUP_DIR$config_path"
    mkdir -p "$(dirname "$backup_path")"
    if [ -e "$config_path" ] || [ -L "$config_path" ]; then
      cp -a "$config_path" "$backup_path"
    else
      : >"$backup_path.splaro-missing"
    fi
  done
}

restore_nginx_config() {
  [ -n "$NGINX_BACKUP_DIR" ] && [ -d "$NGINX_BACKUP_DIR" ] || return 0
  local config_path backup_path
  for config_path in "${NGINX_CONFIG_PATHS[@]}"; do
    backup_path="$NGINX_BACKUP_DIR$config_path"
    if [ -f "$backup_path.splaro-missing" ]; then
      rm -f "$config_path"
    elif [ -e "$backup_path" ] || [ -L "$backup_path" ]; then
      install -d -m 0755 "$(dirname "$config_path")"
      rm -f "$config_path"
      cp -a "$backup_path" "$config_path"
    fi
  done
}

# Safety net — if this script dies AFTER web/admin were stopped for the build
# (to free RAM) but BEFORE the new build finishes and PM2 reloads, the site
# is left down until someone notices and fixes it by hand. Restart whatever
# PM2 already has on any non-zero exit so a failed deploy never means an
# extended outage — worst case it serves the last good build.
on_exit() {
  local code=$?
  rm -f "$DEPLOY_LOCK"
  [ -z "$UPLOAD_SMOKE_FILE" ] || rm -f "$UPLOAD_SMOKE_FILE"
  [ -z "$TEMP_WEB_PID" ] || kill "$TEMP_WEB_PID" 2>/dev/null || true
  [ -z "$TEMP_ADMIN_PID" ] || kill "$TEMP_ADMIN_PID" 2>/dev/null || true
  if [ "$code" -ne 0 ]; then
    log "Deploy failed (exit $code) — rolling back so the site stays up."
    if [ -n "$NGINX_BACKUP_DIR" ]; then
      restore_nginx_config
      nginx -t >/dev/null 2>&1 && systemctl reload nginx 2>/dev/null || true
      log "Restored previous Nginx configuration"
    fi
    if [ "$RELEASE_SWITCHED" = "1" ] && [ -d "$PREVIOUS_RELEASE" ]; then
      local failed_release="${RELEASE_ROOT}/failed-$(date +%Y%m%d%H%M%S)"
      cd /
      mv "$APP_DIR" "$failed_release"
      mv "$PREVIOUS_RELEASE" "$APP_DIR"
      RELEASE_SWITCHED=0
      log "Restored previous blue/green release"
      if command -v pm2 >/dev/null 2>&1; then
        # Existing PM2 definitions keep fixed /var/www/splaro paths. After the
        # directory rollback, targeted reloads return every process to old code
        # without trusting config naming from either release.
        for app in splaro-web-live splaro-web splaro-admin splaro-api splaro-worker splaro-print splaro-mcp; do
          pm2 describe "$app" >/dev/null 2>&1 || continue
          pm2 reload "$app" --update-env 2>/dev/null || pm2 restart "$app" --update-env 2>/dev/null || true
        done
        pm2 save 2>/dev/null || true
      fi
    fi
    if [ -n "$RELEASE_CANDIDATE" ] && [ -d "$RELEASE_CANDIDATE" ]; then
      rm -rf "$RELEASE_CANDIDATE"
      log "Removed failed blue/green candidate"
    fi
  fi
  if [ -n "$NGINX_BACKUP_DIR" ] && [ -d "$NGINX_BACKUP_DIR" ]; then
    rm -rf "$NGINX_BACKUP_DIR"
  fi
}
trap on_exit EXIT

# Tell cron watchdog to stay quiet while PM2 is mid-reload / Next is booting.
touch_deploy_lock

log "========== VPS DEPLOY START =========="

mkdir -p "$APP_DIR"

# ── Fresh-clone fallback ────────────────────────────────────
# A rebuilt/reprovisioned VPS (or a directory that lost .git some other way)
# would otherwise hard-fail every deploy at "git fetch". Preserve .env across
# the rebuild — everything else in APP_DIR is disposable deploy output.
if [ ! -d "$APP_DIR/.git" ]; then
  log "No git checkout at $APP_DIR — bootstrapping a fresh clone."
  ENV_BACKUP=""
  if [ -f "$APP_DIR/.env" ]; then
    ENV_BACKUP="$(mktemp)"
    cp "$APP_DIR/.env" "$ENV_BACKUP"
  fi
  [ -f "$DEPLOY_KEY" ] || die "Missing deploy key $DEPLOY_KEY — cannot clone. Run hpanel-bootstrap-github.sh first."
  GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    git clone --branch "$BRANCH" "$REPO_SSH" "$APP_DIR.fresh"
  find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$APP_DIR.fresh/." "$APP_DIR/"
  rm -rf "$APP_DIR.fresh"
  if [ -n "$ENV_BACKUP" ]; then
    cp "$ENV_BACKUP" "$APP_DIR/.env"
    rm -f "$ENV_BACKUP"
  fi
  [ -f "$APP_DIR/.env" ] || log "WARNING: no .env present after fresh clone — set one before the app can start."
fi

cd "$APP_DIR" || die "Missing $APP_DIR"
PREVIOUS_SHA="$(git rev-parse HEAD 2>/dev/null || true)"

# Load env
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi

export SPLARO_APP_DIR="$APP_DIR"
export SPLARO_LOG_DIR="${SPLARO_LOG_DIR:-/var/log/splaro}"
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072"

# Uploads must survive blue/green directory swaps. Recover files written by
# older standalone builds before previous release is replaced.
SHARED_UPLOAD_DIR="${UPLOAD_DIR:-/var/www/splaro-shared/uploads}"
install -d -m 0755 "$SHARED_UPLOAD_DIR"
for legacy_upload_dir in \
  "$APP_DIR/apps/web/public/uploads" \
  "$APP_DIR/apps/web/.next/standalone/apps/web/public/uploads" \
  "$APP_DIR/apps/admin/.next/standalone/apps/web/public/uploads" \
  "$PREVIOUS_RELEASE/apps/web/public/uploads" \
  "$PREVIOUS_RELEASE/apps/web/.next/standalone/apps/web/public/uploads" \
  "$PREVIOUS_RELEASE/apps/admin/.next/standalone/apps/web/public/uploads"; do
  [ -d "$legacy_upload_dir" ] || continue
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --ignore-existing --chmod=D755,F644 "$legacy_upload_dir/" "$SHARED_UPLOAD_DIR/"
  else
    while IFS= read -r -d '' legacy_file; do
      relative_file="${legacy_file#"$legacy_upload_dir"/}"
      shared_file="$SHARED_UPLOAD_DIR/$relative_file"
      [ -e "$shared_file" ] && continue
      install -d -m 0755 "$(dirname "$shared_file")"
      install -m 0644 "$legacy_file" "$shared_file"
    done < <(find "$legacy_upload_dir" -type f -print0)
  fi
done
export UPLOAD_DIR="$SHARED_UPLOAD_DIR"
log "Persistent uploads ready: $SHARED_UPLOAD_DIR"

ensure_swap() {
  if swapon --show 2>/dev/null | grep -q .; then
    log "Swap ready"
    return 0
  fi
  if [ ! -f /swapfile ]; then
    log "Creating 4G swapfile..."
    fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile 2>/dev/null || true
  grep -q '/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  swapon --show 2>/dev/null | grep -q . || die "Swap unavailable — refusing memory-risk deploy"
  log "Swap enabled"
}

wait_for_local_health() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local delay="${4:-3}"
  local code="000"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then
      log "$label healthy (HTTP $code) after ${i} attempt(s)"
      return 0
    fi
    log "Waiting for $label… HTTP $code (attempt $i/$attempts)"
    sleep "$delay"
    i=$((i + 1))
  done
  log "$label not ready after $attempts attempts (last HTTP $code)"
  return 1
}

# ── Git sync ─────────────────────────────────────────────────
# Hard-reset to origin so stray edits on the VPS can never block a deploy.
# The VPS working tree is a deploy target, not a dev checkout.
log "Syncing to origin/$BRANCH..."
GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git fetch origin "$BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
if [ -n "$DEPLOY_SHA" ]; then
  git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null || die "CI-approved commit not found: $DEPLOY_SHA"
  git merge-base --is-ancestor "$DEPLOY_SHA" "origin/$BRANCH" \
    || die "Refusing deploy: $DEPLOY_SHA is not on origin/$BRANCH"
  git reset --hard "$DEPLOY_SHA"
  log "Pinned to CI-approved commit $DEPLOY_SHA"
else
  log "WARNING: SPLARO_DEPLOY_SHA missing — manual deploy uses origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

# Install bounded app-log retention on every release. Hourly invocation makes
# maxsize effective during error spikes instead of waiting for next daily run.
if command -v logrotate >/dev/null 2>&1; then
  install -m 0644 infrastructure/vps/logrotate-splaro.conf /etc/logrotate.d/splaro
  install -m 0644 infrastructure/vps/cron-splaro-logrotate /etc/cron.d/splaro-logrotate
  log "Hourly app log rotation ready (50M/file, 7 rotations)"
else
  log "WARNING: logrotate unavailable — app logs are not size-bounded"
fi

# API-only releases never rebuild, move, stop, or reload storefront/admin.
# Documentation and this deploy script itself are neutral for scope detection,
# allowing uptime hardening to ship beside an API change without forcing Next.
DEPLOY_SCOPE="full"
CHANGED_FILES=""
if [ -n "$PREVIOUS_SHA" ] && git cat-file -e "${PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  CHANGED_FILES="$(git diff --name-only "$PREVIOUS_SHA" HEAD)"
  API_CHANGE=0
  API_ONLY=1
  while IFS= read -r changed_file; do
    [ -n "$changed_file" ] || continue
    case "$changed_file" in
      apps/api/*) API_CHANGE=1 ;;
      docs/*|infrastructure/vps/deploy.sh|infrastructure/vps/logrotate-splaro.conf|infrastructure/vps/cron-splaro-logrotate) ;;
      *) API_ONLY=0 ;;
    esac
  done <<<"$CHANGED_FILES"
  if [ "$API_CHANGE" = "1" ] && [ "$API_ONLY" = "1" ]; then
    DEPLOY_SCOPE="api"
  fi
fi
log "Deploy scope: $DEPLOY_SCOPE"

# Fail fast on missing/placeholder production secrets before a long build.
# Re-load .env after sync in case deploy pinned a commit that documents new keys.
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi
log "Validating production env..."
NODE_ENV=production FORCE_PRODUCTION_ENV_CHECK=1 node scripts/validate-production-env.mjs \
  || die "Production env check failed — fix .env then redeploy"

# ── pnpm ─────────────────────────────────────────────────────
export PNPM_HOME="${PNPM_HOME:-/root/.local/share/pnpm}"
export PATH="$PNPM_HOME:/root/.local/bin:$PATH"
[ -f infrastructure/hostinger/ensure-pnpm.sh ] && bash infrastructure/hostinger/ensure-pnpm.sh
command -v pnpm >/dev/null || die "pnpm not found"

ensure_swap

log "pnpm install (memory-safe)..."
export npm_config_child_concurrency="${npm_config_child_concurrency:-1}"
export PNPM_NETWORK_CONCURRENCY="${PNPM_NETWORK_CONCURRENCY:-8}"
NODE_ENV=development pnpm install --frozen-lockfile --prod=false --network-concurrency="$PNPM_NETWORK_CONCURRENCY"

log "Prisma..."
pnpm db:generate
pnpm db:migrate:prod || die "Prisma migrate deploy failed — refuse silent db push"

log "Bootstrap store contact from .env (idempotent)…"
pnpm db:bootstrap-store 2>&1 | tail -8 || log "WARN: store bootstrap skipped"

log "Build..."
# 8GB VPS OOM-kills parallel turbo (api tsc + two next builds) → exit 137 and
# leaves dist/.next wiped. Sequential + concurrency=1 keeps the site rebuildable.
# Swap already verified before dependency install; keep this idempotent guard
# next to build too in case an operator disabled swap during a long deploy.
ensure_swap

if [ "$DEPLOY_SCOPE" = "api" ]; then
  log "API-only rolling release — storefront/admin remain online and untouched."
  pnpm --filter @splaro/types build
  pnpm --filter @splaro/config build
  pnpm --filter @splaro/invoice-generator build
  pnpm --filter @splaro/api build
  touch_deploy_lock
  pm2 reload splaro-api --update-env
  pm2 save
else
  # Blue/green: build in an isolated checkout while current PM2 processes keep
  # serving. Only after both standalone apps pass local preflight do we swap
  # directory names and ask PM2 cluster mode for a rolling reload.
  mkdir -p "$RELEASE_ROOT"
  RELEASE_CANDIDATE="${RELEASE_ROOT}/candidate-${DEPLOY_SHA:-$(git rev-parse HEAD)}"
  rm -rf "$RELEASE_CANDIDATE"
  log "Blue/green candidate: $RELEASE_CANDIDATE"
  GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    git clone --no-checkout "$REPO_SSH" "$RELEASE_CANDIDATE"
  cd "$RELEASE_CANDIDATE"
  git checkout --detach "${DEPLOY_SHA:-origin/$BRANCH}"
  cp --preserve=mode "$APP_DIR/.env" .env
  set -a && source .env && set +a
  export SPLARO_APP_DIR="$RELEASE_CANDIDATE"
  export TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-1}"
  export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072"

  log "Installing blue/green candidate dependencies…"
  NODE_ENV=development pnpm install --frozen-lockfile --prod=false --network-concurrency="$PNPM_NETWORK_CONCURRENCY"
  log "Building candidate sequentially (live storefront stays online)…"
  touch_deploy_lock
  pnpm --filter @splaro/types build
  pnpm --filter @splaro/config build
  pnpm --filter @splaro/invoice-generator build
  pnpm --filter @splaro/print-service build
  pnpm --filter @splaro/api build
  pnpm --filter @splaro/worker build
  touch_deploy_lock
  pnpm --filter @splaro/web build
  [ -f apps/web/.next/standalone/apps/web/server.js ] \
    || die "Web standalone missing after candidate build — likely OOM."
  touch_deploy_lock
  pnpm --filter @splaro/admin build
  [ -f apps/admin/.next/standalone/apps/admin/server.js ] \
    || die "Admin standalone missing after candidate build — likely OOM."
  node scripts/prepare-next-standalone.mjs apps/web
  node scripts/prepare-next-standalone.mjs apps/admin

  log "Candidate preflight on :3100 and :3101…"
  (cd apps/web && PORT=3100 HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js) \
    >>"$LOG_FILE" 2>&1 &
  TEMP_WEB_PID=$!
  wait_for_local_health "http://127.0.0.1:3100/" "candidate web" 30 2 \
    || die "Candidate web preflight failed"
  kill "$TEMP_WEB_PID" 2>/dev/null || true
  wait "$TEMP_WEB_PID" 2>/dev/null || true
  TEMP_WEB_PID=""
  (cd apps/admin && PORT=3101 HOSTNAME=127.0.0.1 node .next/standalone/apps/admin/server.js) \
    >>"$LOG_FILE" 2>&1 &
  TEMP_ADMIN_PID=$!
  wait_for_local_health "http://127.0.0.1:3101/login" "candidate admin" 30 2 \
    || die "Candidate admin preflight failed"
  kill "$TEMP_ADMIN_PID" 2>/dev/null || true
  wait "$TEMP_ADMIN_PID" 2>/dev/null || true
  TEMP_ADMIN_PID=""

  # Keep previous immutable chunks/assets available during rolling reload, so
  # in-flight HTML from old workers never points at a suddenly missing file.
  cp -an "$APP_DIR/apps/web/.next/static/." apps/web/.next/static/ 2>/dev/null || true
  cp -an "$APP_DIR/apps/web/public/." apps/web/public/ 2>/dev/null || true
  # Nginx aliases apps/web/.next/static; standalone Node must serve the same merged tree.
  node scripts/prepare-next-standalone.mjs apps/web
  node scripts/prepare-next-standalone.mjs apps/admin

  log "Switching blue/green release…"
  cd /
  rm -rf "$PREVIOUS_RELEASE"
  mv "$APP_DIR" "$PREVIOUS_RELEASE"
  mv "$RELEASE_CANDIDATE" "$APP_DIR"
  RELEASE_SWITCHED=1
  cd "$APP_DIR"
  export SPLARO_APP_DIR="$APP_DIR"
  set -a && source .env && set +a

  PM2_CONFIG="$APP_DIR/infrastructure/pm2/ecosystem.config.js"
  [ -f "$PM2_CONFIG" ] || PM2_CONFIG="$APP_DIR/infrastructure/pm2/ecosystem.hostinger.config.js"
  log "PM2 rolling reload…"
  pm2 startOrReload "$PM2_CONFIG" --update-env
  pm2 save
  # Reap node workers still running from the previous release directory.
  # PM2 cluster reload can leave an old API pid attached to :4000 (mixed health/build).
  if [ -d "$PREVIOUS_RELEASE" ]; then
    for pid in $(ps -eo pid= -o cmd= | awk '/apps\/(api\/dist\/main\.js|web\/\.next\/standalone\/apps\/web\/server\.js)/ {print $1}'); do
      [ -r "/proc/$pid/cwd" ] || continue
      cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
      case "$cwd" in
        "$PREVIOUS_RELEASE"*) log "Reaping stale pid $pid cwd=$cwd"; kill "$pid" 2>/dev/null || true ;;
      esac
    done
  fi
  touch_deploy_lock
  wait_for_local_health "http://127.0.0.1:3000/" "web" 30 2 || die "Web failed after release switch"
  wait_for_local_health "http://127.0.0.1:3001/login" "admin" 30 2 || die "Admin failed after release switch"
  wait_for_local_health "http://127.0.0.1:4000/api/v1/health" "api" 40 3 || die "API failed after release switch"
  EXPECTED_BUILD="$(tr -d '\n' < "$APP_DIR/apps/web/.next/BUILD_ID" 2>/dev/null || true)"
  LIVE_BUILD="$(curl -s --max-time 5 http://127.0.0.1:3000/api/build-id 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildId',''))" 2>/dev/null || true)"
  if [ -n "$EXPECTED_BUILD" ] && [ "$LIVE_BUILD" != "$EXPECTED_BUILD" ]; then
    die "Web BUILD_ID mismatch after reload (disk=$EXPECTED_BUILD live=$LIVE_BUILD)"
  fi
  log "Blue/green release active; previous release retained at $PREVIOUS_RELEASE (web BUILD_ID=$LIVE_BUILD)"
  # Rollback if this release misbehaves:
  #   mv /var/www/splaro /var/www/splaro-releases/failed
  #   mv /var/www/splaro-releases/previous /var/www/splaro
  #   pm2 startOrReload /var/www/splaro/infrastructure/pm2/ecosystem.config.js --update-env
  # Previous hashed /_next/static chunks are copied into the candidate (cp -an) then
  # re-packed into standalone. Older than N-1 builds may be pruned later if disk is tight.
fi

# ── Meilisearch + Nginx performance (idempotent, safe reload) ─
backup_nginx_config
install -d -m 0755 /etc/nginx/snippets
install -m 0644 infrastructure/nginx/snippets/splaro-uploads.conf /etc/nginx/snippets/splaro-uploads.conf
if [ -f infrastructure/vps/setup-meilisearch.sh ]; then
  bash infrastructure/vps/setup-meilisearch.sh || log "WARN: Meilisearch setup skipped"
fi
if [ -f infrastructure/vps/setup-nginx-performance.sh ]; then
  bash infrastructure/vps/setup-nginx-performance.sh || log "WARN: nginx performance skipped"
fi

if [ -f /etc/nginx/sites-enabled/splaro.co.conf ] || [ -f /etc/nginx/sites-available/splaro.co.conf ]; then
  cp infrastructure/vps/nginx-splaro.co.conf /etc/nginx/sites-available/splaro.co.conf
  ln -sf /etc/nginx/sites-available/splaro.co.conf /etc/nginx/sites-enabled/splaro.co.conf
  rm -f /etc/nginx/sites-enabled/splaro-web.conf \
    /etc/nginx/sites-enabled/splaro-admin.conf \
    /etc/nginx/sites-enabled/splaro-api.conf
elif [ -f infrastructure/hostinger/splaro-co-web.conf ]; then
  cp infrastructure/hostinger/splaro-co-web.conf /etc/nginx/sites-available/splaro-web.conf
  cp infrastructure/hostinger/splaro-co-admin.conf /etc/nginx/sites-available/splaro-admin.conf
  cp infrastructure/hostinger/splaro-co-api.conf /etc/nginx/sites-available/splaro-api.conf
  ln -sf /etc/nginx/sites-available/splaro-web.conf /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/splaro-admin.conf /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/splaro-api.conf /etc/nginx/sites-enabled/
fi

# ── Nginx ────────────────────────────────────────────────────
nginx -t || die "Nginx config validation failed"
systemctl reload nginx || die "Nginx reload failed"

UPLOAD_SMOKE_FILE="$SHARED_UPLOAD_DIR/.splaro-upload-smoke.webp"
printf 'RIFF\x04\x00\x00\x00WEBP' > "$UPLOAD_SMOKE_FILE"
chmod 0644 "$UPLOAD_SMOKE_FILE"
SMOKE_HEADERS="$(curl -ksSI --resolve splaro.co:443:127.0.0.1 https://splaro.co/uploads/.splaro-upload-smoke.webp)"
rm -f "$UPLOAD_SMOKE_FILE"
grep -qi '^content-type: image/webp' <<<"$SMOKE_HEADERS" || die "Upload smoke returned wrong MIME"
grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$SMOKE_HEADERS" || die "Upload smoke missing immutable cache"
MISSING_HEADERS="$(curl -ksSI --resolve splaro.co:443:127.0.0.1 https://splaro.co/uploads/.splaro-upload-missing.webp)"
grep -qi '^HTTP/.* 404' <<<"$MISSING_HEADERS" || die "Missing upload smoke did not return 404"
if grep -qi '^cache-control:.*immutable' <<<"$MISSING_HEADERS"; then
  die "Missing upload response is incorrectly immutable"
fi
log "Upload delivery smoke passed"

maybe_purge_demo_catalog() {
  if [ "${SPLARO_PURGE_DEMO_ON_DEPLOY:-0}" != "1" ]; then
    log "Demo purge skipped (SPLARO_PURGE_DEMO_ON_DEPLOY≠1 — real catalog safe on deploy)"
    return 0
  fi

  local store="${NEXT_PUBLIC_STORE_ID:-splaro}"

  if [ -n "${INTERNAL_HEALTH_SECRET:-}" ]; then
    local body_file
    body_file="$(mktemp)"
    local code
    code="$(curl -s -m 120 -o "$body_file" -w '%{http_code}' -X POST \
      "http://127.0.0.1:4000/api/v1/storefront/deploy/purge-demo?storeId=${store}" \
      -H "x-splaro-internal: ${INTERNAL_HEALTH_SECRET}" \
      -H "Content-Type: application/json" || echo 000)"
    local body
    body="$(tr -d '\n' < "$body_file" | head -c 400)"
    rm -f "$body_file"
    if [ "$code" = "200" ] || [ "$code" = "201" ]; then
      log "Demo purge (API): HTTP $code — $body"
      return 0
    fi
    log "WARN: demo purge API failed (HTTP $code) — $body — falling back to script"
  else
    log "WARN: INTERNAL_HEALTH_SECRET unset — demo purge via script only (no cache bust)"
  fi

  pnpm db:purge-demo 2>&1 | tail -12 || log "WARN: demo purge script failed"
}

maybe_seed_demo_catalog() {
  if [ -z "${INTERNAL_HEALTH_SECRET:-}" ]; then
    log "Demo seed skipped — INTERNAL_HEALTH_SECRET unset"
    return 0
  fi

  local store="${NEXT_PUBLIC_STORE_ID:-splaro}"
  local body_file
  body_file="$(mktemp)"
  local code
  code="$(curl -s -m 120 -o "$body_file" -w '%{http_code}' -X POST \
    "http://127.0.0.1:4000/api/v1/storefront/deploy/seed-demo?storeId=${store}" \
    -H "x-splaro-internal: ${INTERNAL_HEALTH_SECRET}" \
    -H "Content-Type: application/json" || echo 000)"
  local body
  body="$(tr -d '\n' < "$body_file" | head -c 400)"
  rm -f "$body_file"
  log "Demo seed (if empty): HTTP $code — $body"
}

maybe_reindex_search() {
  if [ -z "${INTERNAL_HEALTH_SECRET:-}" ] || [ -z "${MEILISEARCH_HOST:-}" ]; then
    return 0
  fi
  if ! curl -sf -m 5 "${MEILISEARCH_HOST}/health" >/dev/null 2>&1; then
    log "Meilisearch not healthy — skipping search reindex"
    return 0
  fi
  local store="${NEXT_PUBLIC_STORE_ID:-splaro}"
  local res
  res="$(curl -sf -m 120 -X POST \
    "http://127.0.0.1:4000/api/v1/search/deploy/reindex?storeId=${store}" \
    -H "x-splaro-internal: ${INTERNAL_HEALTH_SECRET}" \
    -H "Content-Type: application/json" 2>&1)" || {
    log "WARN: search reindex skipped ($res)"
    return 0
  }
  log "Search reindex: $res"
}

maybe_revalidate_storefront() {
  if [ -z "${REVALIDATE_SECRET:-}" ]; then
    log "Storefront revalidate skipped (REVALIDATE_SECRET unset)"
    return 0
  fi
  local body='{"tags":["storefront-settings","storefront-products","storefront-banners"]}'
  local code
  code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST \
    "http://127.0.0.1:3000/api/revalidate" \
    -H "x-revalidate-secret: ${REVALIDATE_SECRET}" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    log "Storefront Next.js cache revalidated (tags: settings, products, banners)"
  else
    log "WARN: storefront revalidate failed (HTTP $code)"
  fi
}

sleep 6

if pnpm db:enable-telegram 2>/dev/null; then
  log "Telegram — all notification flags enabled"
  pm2 reload splaro-api --update-env 2>/dev/null || true
else
  log "WARN: telegram enable skipped (no config yet)"
fi

# API restarts after telegram enable — cluster mode needs time to bind :4000
wait_for_local_health "http://127.0.0.1:3000/" "web" 20 2 || true
wait_for_local_health "http://127.0.0.1:3001/login" "admin" 30 2 || true
wait_for_local_health "http://127.0.0.1:4000/api/v1/health" "api" 40 3 || die "Health check failed — pm2 logs splaro-api"
wait_for_local_health "http://127.0.0.1:4005/health" "mcp" 20 2 || log "WARN: splaro-mcp health missed — check pm2 logs splaro-mcp"

maybe_purge_demo_catalog
maybe_seed_demo_catalog
maybe_reindex_search
maybe_revalidate_storefront

WEB="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/ 2>/dev/null || echo 000)"
ADMIN="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3001/login 2>/dev/null || echo 000)"
API="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4000/api/v1/health 2>/dev/null || echo 000)"
MCP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4005/health 2>/dev/null || echo 000)"

log "Health — web:$WEB admin:$ADMIN api:$API mcp:$MCP"
log "========== VPS DEPLOY COMPLETE =========="
log "Tip: install watchdog cron — see infrastructure/vps/splaro-watchdog.sh"

[ "$WEB" = "200" ] && [ "$ADMIN" = "200" ] && [ "$API" = "200" ] || die "Health check failed — pm2 logs"
