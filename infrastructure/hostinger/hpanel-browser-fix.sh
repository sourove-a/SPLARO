#!/bin/bash
# hPanel → Advanced → SSH Terminal (browser) — one paste to fix splaro.co live
# Requires: Git deploy connected OR repo at .builds/source/repository
set +e
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/pgenv/bin:$PATH"
REPO="$HOME/domains/splaro.co/public_html/.builds/source/repository"
if [ ! -f "$REPO/pnpm-workspace.yaml" ]; then
  echo "Repo missing — hPanel → splaro.co → Deployments → connect GitHub + Deploy now"
  exit 1
fi
cd "$REPO"
git pull origin main 2>/dev/null || true
bash infrastructure/hostinger/fix-all-live.sh
echo ""
echo "=== Manual hPanel steps (SSL) ==="
echo "1. Websites → splaro.co → Subdomains → create 'admin' → public_html/admin"
echo "2. SSL → Issue certificate for admin.splaro.co (and splaro.co if missing)"
echo "3. Environment variables — see infrastructure/hostinger/env.production.example"
