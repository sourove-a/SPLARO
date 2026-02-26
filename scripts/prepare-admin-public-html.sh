#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PUBLIC_DIR="$ROOT_DIR/public"
TARGET_DIR="$ROOT_DIR/public_html/admin"

echo "[prepare-admin-public-html] building frontend..."
(cd "$ROOT_DIR" && npm run build >/dev/null)

echo "[prepare-admin-public-html] ensuring target directory..."
mkdir -p "$TARGET_DIR"

echo "[prepare-admin-public-html] cleaning previous admin assets (preserving env files)..."
find "$TARGET_DIR" -mindepth 1 \
  ! -name '.env' \
  ! -name '.env.local' \
  ! -name '.env.production' \
  ! -path "$TARGET_DIR/assets" \
  ! -path "$TARGET_DIR/assets/*" \
  -exec rm -rf {} +

echo "[prepare-admin-public-html] copying dist files..."
cp -R "$DIST_DIR"/. "$TARGET_DIR"/

# Safety: prevent recursive admin mirror (public/admin -> dist/admin -> target/admin).
if [ -d "$TARGET_DIR/admin" ]; then
  echo "[prepare-admin-public-html] removing nested admin mirror..."
  rm -rf "$TARGET_DIR/admin"
fi

echo "[prepare-admin-public-html] copying php api..."
mkdir -p "$TARGET_DIR/api"
cp -R "$PUBLIC_DIR/api"/. "$TARGET_DIR/api"/

if [ -f "$PUBLIC_DIR/.htaccess" ]; then
  echo "[prepare-admin-public-html] copying .htaccess..."
  cp "$PUBLIC_DIR/.htaccess" "$TARGET_DIR/.htaccess"
fi

if [ -f "$PUBLIC_DIR/index.php" ]; then
  echo "[prepare-admin-public-html] copying index.php fallback..."
  cp "$PUBLIC_DIR/index.php" "$TARGET_DIR/index.php"
fi

echo "[prepare-admin-public-html] done: $TARGET_DIR"
