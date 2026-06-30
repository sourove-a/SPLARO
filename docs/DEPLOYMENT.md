# SPLARO — Hostinger VPS Deployment Guide

## Prerequisites

- Hostinger KVM VPS (minimum: 4 vCPU, 8GB RAM, 100GB NVMe)
- Ubuntu 22.04 LTS
- Domain: splaro.com.bd (DNS pointed to VPS IP)
- GitHub repository with SPLARO codebase

---

## Step 1 — Server Setup

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Run setup script (installs Node, PostgreSQL, Redis, Nginx, PM2, SSL tools)
bash <(curl -fsSL https://raw.githubusercontent.com/your-org/splaro-brand/main/infrastructure/scripts/setup-server.sh)
```

---

## Step 2 — Clone Repository

```bash
cd /var/www/splaro
git clone https://github.com/your-org/splaro-brand.git .
```

---

## Step 3 — Environment Variables

```bash
cp .env.example .env.local
nano .env.local  # Fill in all values
```

**Critical values to set first:**
- `DATABASE_URL` — point to your local PostgreSQL
- `REDIS_URL` — local Redis
- `JWT_SECRET` — generate: `openssl rand -base64 64`
- `NEXT_PUBLIC_SITE_URL` — `https://splaro.com.bd`

---

## Step 4 — Configure Nginx

```bash
cp infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
cp infrastructure/nginx/splaro-web.conf /etc/nginx/sites-available/splaro.conf
ln -s /etc/nginx/sites-available/splaro.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Step 5 — SSL Certificate

```bash
certbot --nginx \
  -d splaro.com.bd \
  -d www.splaro.com.bd \
  -d api.splaro.com.bd \
  -d admin.splaro.com.bd \
  --email info@splaro.com.bd \
  --agree-tos \
  --non-interactive
```

---

## Step 6 — Deploy Application

```bash
chmod +x infrastructure/scripts/deploy.sh
bash infrastructure/scripts/deploy.sh
```

This script:
1. Pulls latest code
2. Installs dependencies
3. Generates Prisma client
4. Runs database migrations
5. Builds all apps
6. Restarts PM2 processes
7. Reloads Nginx
8. Runs health checks

---

## Step 7 — Verify

```bash
# Check all processes
pm2 status

# Check logs
pm2 logs splaro-web
pm2 logs splaro-api

# Test URLs
curl -I https://splaro.com.bd
curl -I https://api.splaro.com.bd/api/v1/health
curl -I https://admin.splaro.com.bd
```

---

## Automated Backups

```bash
# Add to crontab (runs at 2AM daily)
crontab -e
# Add:
0 2 * * * bash /var/www/splaro/infrastructure/scripts/backup-db.sh
```

---

## SSL Auto-Renewal

Certbot installs a cron job automatically. Verify:
```bash
certbot renew --dry-run
```

---

## Useful Commands

```bash
# Restart all
pm2 restart all

# View real-time logs
pm2 logs

# Monitor resources
pm2 monit

# Database migrations (production)
cd /var/www/splaro && pnpm db:migrate:prod

# Force rebuild
pnpm build:all && pm2 reload ecosystem.config.js
```
