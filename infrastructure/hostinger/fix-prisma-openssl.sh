#!/bin/bash
set -euo pipefail
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/pgenv/bin:$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
SCHEMA="$REPO/packages/database/prisma/schema.prisma"

if ! grep -q 'debian-openssl-3.0.x' "$SCHEMA"; then
  sed -i '/previewFeatures = \["fullTextSearch", "fullTextIndex"\]/a\  binaryTargets   = ["native", "debian-openssl-3.0.x"]' "$SCHEMA"
fi

cd "$REPO"
set -a && source .env && set +a
pnpm db:generate 2>&1 | tail -8
touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
sleep 12
curl -s -m 25 "http://127.0.0.1:4000/api/v1/storefront/settings?storeId=splaro" | head -c 400
echo
curl -s -m 25 "http://127.0.0.1:4000/api/v1/storefront/products?storeId=splaro&limit=3" | head -c 500
echo
