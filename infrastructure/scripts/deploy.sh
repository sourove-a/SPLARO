#!/bin/bash
# ============================================================
# SPLARO — Production Deployment Script
# Run from: /var/www/splaro
# ============================================================

set -euo pipefail

APP_DIR="/var/www/splaro"
LOG_FILE="/var/log/splaro/deploy.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

log() { echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"; }
error() { echo "[$TIMESTAMP] ERROR: $1" | tee -a "$LOG_FILE" >&2; exit 1; }

log "========== SPLARO DEPLOYMENT STARTED =========="

# ── PULL LATEST CODE ────────────────────────────────────────
log "Pulling latest code..."
cd "$APP_DIR" || error "Cannot cd to $APP_DIR"
git pull origin main || error "Git pull failed"

# ── INSTALL DEPENDENCIES ─────────────────────────────────────
log "Installing dependencies..."
pnpm install --frozen-lockfile || error "pnpm install failed"

# ── GENERATE PRISMA CLIENT ───────────────────────────────────
log "Generating Prisma client..."
pnpm db:generate || error "Prisma generate failed"

# ── RUN DATABASE MIGRATIONS ──────────────────────────────────
log "Running database migrations..."
pnpm db:migrate:prod || error "Database migration failed"

# ── BUILD ALL APPS ───────────────────────────────────────────
log "Building all applications..."
pnpm build:all || error "Build failed"

# ── RESTART PM2 PROCESSES ────────────────────────────────────
log "Restarting PM2 processes..."
pm2 reload infrastructure/pm2/ecosystem.config.js --update-env || error "PM2 reload failed"

# ── RELOAD NGINX ─────────────────────────────────────────────
log "Testing and reloading Nginx..."
nginx -t || error "Nginx config test failed"
systemctl reload nginx || error "Nginx reload failed"

# ── HEALTH CHECKS ────────────────────────────────────────────
log "Running health checks..."
sleep 5

WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/health)

if [ "$WEB_STATUS" != "200" ]; then
    log "WARNING: Web health check returned $WEB_STATUS"
else
    log "Web: OK ($WEB_STATUS)"
fi

if [ "$API_STATUS" != "200" ]; then
    log "WARNING: API health check returned $API_STATUS"
else
    log "API: OK ($API_STATUS)"
fi

log "========== DEPLOYMENT COMPLETE =========="
pm2 status
