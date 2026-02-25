#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PUBLIC_DIR="$ROOT_DIR/public"
TARGET_DIR="$ROOT_DIR/public_html"

echo "[prepare-public-html] building frontend..."
(cd "$ROOT_DIR" && npm run build >/dev/null)

echo "[prepare-public-html] ensuring target directory..."
mkdir -p "$TARGET_DIR"

echo "[prepare-public-html] cleaning previous web assets (preserving env files)..."
find "$TARGET_DIR" -mindepth 1 \
  ! -name '.env' \
  ! -name '.env.local' \
  ! -name '.env.production' \
  -exec rm -rf {} +

echo "[prepare-public-html] copying dist files..."
cp -R "$DIST_DIR"/. "$TARGET_DIR"/

echo "[prepare-public-html] copying php api..."
mkdir -p "$TARGET_DIR/api"
cp -R "$PUBLIC_DIR/api"/. "$TARGET_DIR/api"/

if [ -f "$PUBLIC_DIR/.htaccess" ]; then
  echo "[prepare-public-html] copying .htaccess..."
  cp "$PUBLIC_DIR/.htaccess" "$TARGET_DIR/.htaccess"
fi

echo "[prepare-public-html] done: $TARGET_DIR"
