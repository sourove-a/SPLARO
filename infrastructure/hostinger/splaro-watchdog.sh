#!/bin/bash
# SPLARO watchdog — restart dead services. Cron: */5 min + @reboot.
# Thread-budget safe: v8-pool-size=1 + UV_THREADPOOL_SIZE=2 + taskset (CloudLinux NPROC counts threads; Prisma/tokio + V8 size pools to visible cores).
export PATH="$HOME/mamba/env/envs/pg/bin:/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
NODEJS="$HOME/domains/splaro.co/nodejs"
NODEBIN=/opt/alt/alt-nodejs20/root/usr/bin/node
LOG="$NODEJS/watchdog.log"
log() { echo "[watchdog $(date '+%F %H:%M:%S')] $*" >> "$LOG"; }

exec 9>"$HOME/.splaro-watchdog.lock"
flock -n 9 || exit 0

# 1. PostgreSQL :5433
if ! pg_ctl -D "$HOME/pgsql/data" status >/dev/null 2>&1; then
  log "Postgres down — starting"
  rm -f "$HOME/pgsql/data/postmaster.pid"
  pg_ctl -D "$HOME/pgsql/data" -l "$HOME/pgsql/postgres.log" -o "-p 5433" start >/dev/null 2>&1
  sleep 5
fi

set -a; . "$REPO/.env" 2>/dev/null; set +a

# 2. API :4000
if ! curl -sf -m 8 http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1; then
  log "API down — restarting"
  pkill -f "apps/api.*dist/main.js" 2>/dev/null; pkill -f "node dist/main.js" 2>/dev/null
  sleep 2
  cd "$REPO/apps/api" && API_PORT=4000 UV_THREADPOOL_SIZE=2 NODE_OPTIONS="--max-old-space-size=512 --v8-pool-size=1" \
    setsid nohup taskset -c 0,1 "$NODEBIN" dist/main.js >> "$NODEJS/api-live.log" 2>&1 < /dev/null &
fi

NEXT_BIN=$(find "$REPO/node_modules/.pnpm" -path "*next@*/node_modules/next/dist/bin/next" 2>/dev/null | head -1)

# 3. web :3001
if ! curl -sf -m 8 -o /dev/null http://127.0.0.1:3001/ 2>/dev/null; then
  log "web down — restarting"
  pkill -f "apps/web.*next.*start" 2>/dev/null
  sleep 2
  cd "$REPO/apps/web" && PORT=3001 HOSTNAME=127.0.0.1 UV_THREADPOOL_SIZE=2 NODE_OPTIONS="--max-old-space-size=384 --v8-pool-size=1" \
    setsid nohup taskset -c 2,3 "$NODEBIN" "$NEXT_BIN" start >> "$NODEJS/web.log" 2>&1 < /dev/null &
fi

# 4. admin :3002
if ! curl -sf -m 8 -o /dev/null http://127.0.0.1:3002/login 2>/dev/null; then
  log "admin down — restarting"
  pkill -f "apps/admin.*next.*start" 2>/dev/null
  sleep 2
  cd "$REPO/apps/admin" && PORT=3002 HOSTNAME=127.0.0.1 UV_THREADPOOL_SIZE=2 NODE_OPTIONS="--max-old-space-size=384 --v8-pool-size=1" \
    setsid nohup taskset -c 4,5 "$NODEBIN" "$NEXT_BIN" start >> "$NODEJS/admin.log" 2>&1 < /dev/null &
fi
