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
(cd apps/web && npx next build)
(cd apps/admin && npx next build)

echo "[deploy] pm2 reload (splaro only — hunterflow untouched)..."
# One reload per app — a single multi-name reload only restarted the first process.
for proc in splaro-api splaro-web splaro-admin; do
  pm2 reload "$proc" --update-env || pm2 start "$APP/infrastructure/vps/ecosystem.opt.config.js"
done
pm2 save

echo "[deploy] health check..."
for i in $(seq 1 12); do
  if curl -sf http://127.0.0.1:4000/api/v1/health >/dev/null; then
    echo "[deploy] OK $(date)"
    exit 0
  fi
  sleep 5
done
echo "[deploy] FAIL — API health check did not pass within 60s"
pm2 logs splaro-api --lines 20 --nostream
exit 1
