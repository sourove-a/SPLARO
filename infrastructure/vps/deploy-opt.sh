#!/bin/bash
# SPLARO VPS redeploy @ /opt/splaro/app (shared VPS with hunterflow — ports 3001/3002/4000)
set -euo pipefail

APP="${SPLARO_APP_DIR:-/opt/splaro/app}"
BRANCH="${SPLARO_BRANCH:-main}"
cd "$APP"
set -a; . ./.env; set +a
export NODE_ENV=production NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

echo "[deploy] pull main..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[deploy] install..."
pnpm install --frozen-lockfile --prod=false --ignore-scripts

echo "[deploy] prisma..."
(cd packages/database && npx prisma generate && npx prisma db push)

echo "[deploy] build packages + api..."
cd "$APP"
pnpm --filter @splaro/config run build
pnpm --filter @splaro/types run build
pnpm --filter @splaro/api run build

echo "[deploy] build next..."
# Keep previous hashed static chunks so browser tabs opened before the deploy
# don't hit 404 "Loading chunk failed" on the new build.
for app in web admin; do
  [ -d "apps/$app/.next/static" ] && rm -rf "/tmp/splaro-prev-static-$app" \
    && cp -r "apps/$app/.next/static" "/tmp/splaro-prev-static-$app" || true
done
(cd apps/web && npx next build)
(cd apps/admin && npx next build)
for app in web admin; do
  prev="/tmp/splaro-prev-static-$app"
  if [ -d "$prev" ]; then
    cp -rn "$prev/." "apps/$app/.next/static/" 2>/dev/null || true
    rm -rf "$prev"
  fi
done

echo "[deploy] pm2 reload (splaro only — hunterflow untouched)..."
# One reload per app — a single multi-name reload only restarted the first process.
for proc in splaro-api splaro-web splaro-admin; do
  pm2 reload "$proc" --update-env || pm2 start "$APP/infrastructure/vps/ecosystem.opt.config.js"
done
pm2 save

echo "[deploy] health check..."
for i in $(seq 1 12); do
  if curl -sf http://127.0.0.1:4000/api/v1/health >/dev/null; then
    echo "[deploy] API up — running route probe regression guard..."
    if ! node "$APP/scripts/verify-deploy-health.mjs"; then
      echo "[deploy] FAIL — route health regression (see above)"
      pm2 logs splaro-api --lines 30 --nostream
      exit 1
    fi
    echo "[deploy] OK $(date)"
    exit 0
  fi
  sleep 5
done
echo "[deploy] FAIL — API health check did not pass within 60s"
pm2 logs splaro-api --lines 20 --nostream
exit 1
