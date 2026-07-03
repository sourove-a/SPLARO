#!/bin/bash
set -euo pipefail
REPO="${SPLARO_REPO_DIR:-$HOME/domains/splaro.co/public_html/.builds/source/repository}"

patch_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  find "$dir" -name '*.js' -type f | while read -r f; do
    sed -i \
      -e 's|https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg|/images/earth/earth-day.jpg|g' \
      -e 's|https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg|/images/earth/earth-night.jpg|g' \
      -e 's|https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png|/images/earth/earth-bump.png|g' \
      -e 's|https://raw.githubusercontent.com/vasturiano/three-globe/master/example/clouds/clouds.png|/images/earth/earth-clouds.png|g' \
      -e 's|https://cdn.jsdelivr.net/gh/mrdoob/three.js@r149/examples/textures/planets/moon_1024.jpg|/images/earth/moon.jpg|g' \
      -e 's|https://api.splaro.co/api/v1|https://splaro.co/api/v1|g' \
      "$f" || true
  done
}

patch_dir "$REPO/apps/web/.next/static"
patch_dir "$REPO/apps/web/.next/standalone/apps/web/.next/static"
patch_dir "$REPO/apps/web/.next/server"
patch_dir "$REPO/apps/web/.next/standalone/apps/web/.next/server"

touch "$HOME/domains/splaro.co/nodejs/tmp/restart.txt"
echo "Earth texture URLs patched"
