#!/bin/bash
# Recover user-space PostgreSQL after crash/stale lock, then restart Passenger.
export PATH="$HOME/pgenv/bin:/opt/alt/alt-nodejs20/root/usr/bin:$PATH"
PGDATA="$HOME/pgsql/data"
PGLOG="$HOME/pgsql/postgres.log"

echo "=== postgres log tail ==="
tail -15 "$PGLOG" 2>/dev/null || true

if ! pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
  # Remove stale pid if the referenced process is gone
  if [ -f "$PGDATA/postmaster.pid" ]; then
    PID=$(head -1 "$PGDATA/postmaster.pid")
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "removing stale postmaster.pid (pid $PID gone)"
      rm -f "$PGDATA/postmaster.pid"
    else
      echo "postmaster pid $PID still alive but not responding — stopping"
      pg_ctl -D "$PGDATA" stop -m fast 2>/dev/null || kill "$PID" 2>/dev/null || true
      sleep 3
      rm -f "$PGDATA/postmaster.pid"
    fi
  fi
  echo "starting postgres..."
  pg_ctl -D "$PGDATA" -l "$PGLOG" -o "-p 5433" start
  sleep 4
fi

pg_isready -h 127.0.0.1 -p 5433

echo "=== restarting passenger ==="
touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
sleep 15

echo "=== local checks ==="
curl -s -m 10 -o /dev/null -w "api:%{http_code}\n" http://127.0.0.1:4000/api/v1/health || true
curl -s -m 25 "http://127.0.0.1:4000/api/v1/storefront/products?storeId=splaro" | head -c 300
echo
curl -s -m 20 -o /dev/null -w "home-ext:%{http_code}\n" https://splaro.co/ || true
echo "PG_FIX_DONE"
