#!/bin/bash
export PATH="$HOME/pgenv/bin:$PATH"
PGDATA="$HOME/pgsql/data"
if ! pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
  pg_ctl -D "$PGDATA" -l "$HOME/pgsql/postgres.log" -o "-p 5433" start
  sleep 2
fi
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
DB_URL=$(grep '^DATABASE_URL=' "$REPO/.env" | cut -d= -f2-)
if [ -n "$DB_URL" ]; then
  sed -i "s|^DATABASE_URL_SHADOW=.*|DATABASE_URL_SHADOW=${DB_URL}|" "$REPO/.env"
fi
cp "$REPO/infrastructure/hostinger/passenger-stack-app.cjs" "$HOME/domains/splaro.co/nodejs/app.cjs" 2>/dev/null || true
touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
sleep 12
curl -s -m 25 "http://127.0.0.1:4000/api/v1/storefront/products?storeId=splaro" | head -c 600
echo
