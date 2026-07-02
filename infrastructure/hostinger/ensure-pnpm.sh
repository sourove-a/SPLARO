#!/bin/bash
# Hostinger / shared Node: corepack pnpm 11.x → ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
# Use standalone pnpm 9.4.0 (matches packageManager in root package.json).

set -euo pipefail

PNPM_VERSION="${PNPM_VERSION:-9.4.0}"
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"

pnpm_works() {
  command -v pnpm >/dev/null 2>&1 && pnpm --version >/dev/null 2>&1
}

install_standalone_pnpm() {
  echo "[ensure-pnpm] Installing pnpm@${PNPM_VERSION} (standalone)..."
  if command -v corepack >/dev/null 2>&1; then
    corepack disable 2>/dev/null || true
  fi
  echo "[ensure-pnpm] Trying npm global install first..."
  npm install -g "pnpm@${PNPM_VERSION}" --prefix "$HOME/.local" 2>/dev/null \
    || npm install -g "pnpm@${PNPM_VERSION}" 2>/dev/null \
    || true
  export PATH="$HOME/.local/bin:$PNPM_HOME:$PATH"
  if pnpm_works; then
    return 0
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION="$PNPM_VERSION" SHELL=bash sh -
    export PATH="$PNPM_HOME:$HOME/.local/bin:$PATH"
  else
    echo "[ensure-pnpm] curl not found — npm global only" >&2
  fi
}

if pnpm_works; then
  current="$(pnpm --version 2>/dev/null || echo '')"
  case "$current" in
    9.*)
      echo "[ensure-pnpm] OK — pnpm $current"
      exit 0
      ;;
    *)
      echo "[ensure-pnpm] Replacing pnpm ${current:-unknown} with ${PNPM_VERSION}..."
      install_standalone_pnpm
      ;;
  esac
else
  echo "[ensure-pnpm] pnpm missing or broken (corepack?) — installing standalone..."
  install_standalone_pnpm
fi

if ! pnpm_works; then
  echo "[ensure-pnpm] npm global fallback..."
  npm install -g "pnpm@${PNPM_VERSION}" --prefix "$HOME/.local" 2>/dev/null || npm install -g "pnpm@${PNPM_VERSION}"
  export PATH="$HOME/.local/bin:$PATH"
fi

pnpm_works || {
  echo "ERROR: pnpm still not working after install attempts" >&2
  exit 1
}

echo "[ensure-pnpm] OK — pnpm $(pnpm --version)"
