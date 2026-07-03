# Hostinger Deploy — splaro.co (web + admin + API)

## Two deployment modes

| Mode | What runs | Best for |
|------|-----------|----------|
| **A. Git deploy (hPanel)** | Storefront only (`splaro.co`) | Quick web-only; API must live elsewhere |
| **B. SSH full deploy** | Web + admin + API on one server | **Recommended** — full SPLARO stack |

---

## Mode A — Git deploy (storefront only)

Hostinger shared Node.js runs **one** app. This builds **web only**.

### hPanel → Deployments → Settings

| Setting | Value |
|---------|--------|
| Framework | **Express** |
| Package manager | **npm** (not pnpm) |
| Node.js | 20.x |
| Build command | `npm run build` |
| Start command | `npm start` |
| Output directory | `apps/web/.next/standalone/apps/web` or `dist` |

### Required env vars (hPanel → Environment)

```
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://splaro.co
NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1
NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co
NEXT_PUBLIC_CDN_URL=https://splaro.co
```

Build log should show:
```
[ensure-pnpm] OK — pnpm 9.4.0
Building storefront (@splaro/web)...
Build OK — standalone: .../server.js
```

Push from Mac: `pnpm deploy:hostinger`

---

## Mode B — Full stack (web + admin + API) — **recommended**

Use **Hostinger VPS** or SSH-enabled hosting + PM2.

### 1. DNS (hPanel → Domains → DNS)

| Type | Name | Points to |
|------|------|-----------|
| A | `@` | Server IP |
| A | `www` | Server IP |
| A | `admin` | Server IP |
| A | `api` | Server IP |

### 2. Database

**Option 1 — Neon (easiest on shared/VPS without local Postgres):**
```
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/splaro_db?sslmode=require
```

**Option 2 — Local Postgres on VPS** (setup-server.sh)

### 3. Deploy on server

**hPanel Browser Terminal** (if Mac SSH times out):

```bash
mkdir -p ~/splaro/logs
cd ~/splaro || git clone https://github.com/sourove-a/SPLARO.git ~/splaro
cd ~/splaro

# First time only — generate secrets:
bash infrastructure/hostinger/generate-production-env.sh > .env
# Edit .env — set DATABASE_URL (Neon) if no local Postgres
chmod 600 .env

export SPLARO_APP_DIR=$HOME/splaro
bash infrastructure/hostinger/deploy-remote.sh
```

### 4. What deploy-remote.sh does

1. `pnpm install` + Prisma migrate + seed
2. `pnpm build:all` (web, admin, api)
3. `prepare-next-standalone` for web + admin
4. PM2 starts:
   - `splaro-web` → :3000
   - `splaro-admin` → :3001
   - `splaro-api` → :4000
5. nginx vhosts (if root) or manual hPanel reverse proxy

### 5. Reverse proxy (if no nginx root)

Point in hPanel:
- `splaro.co` → `127.0.0.1:3000`
- `admin.splaro.co` → `127.0.0.1:3001`
- `api.splaro.co` → `127.0.0.1:4000`

Config templates: `infrastructure/hostinger/splaro-co-*.conf`

### 6. Verify

```bash
curl -s http://127.0.0.1:4000/api/v1/health
pm2 status
pm2 logs splaro-api --lines 50
```

From Mac (after deploy):
```bash
pnpm verify:production
```

### 7. GitHub Actions (SSH from cloud)

Repo → Settings → Secrets:
- `HOSTINGER_HOST`, `HOSTINGER_PORT` (65002), `HOSTINGER_USER`, `HOSTINGER_PASSWORD`
- `SPLARO_PRODUCTION_ENV_B64` = `base64 -i .env`

Actions → **Deploy Hostinger** → Run workflow

---

## Mac SSH blocked?

Port 65002 often blocked by ISP. Use:
1. hPanel **Browser Terminal**
2. Mobile hotspot
3. GitHub Actions deploy workflow
4. `pnpm deploy:hostinger` for web-only Git redeploy

---

## Production checklist

- [ ] `PAYMENT_DEV_STUB=false`
- [ ] `DATABASE_URL` set (Neon or local)
- [ ] `JWT_SECRET` / `ENCRYPTION_KEY` — random, not defaults
- [ ] `CORS_ORIGINS=https://splaro.co,https://admin.splaro.co`
- [ ] API health: `https://api.splaro.co/api/v1/health` → 200
- [ ] Admin login works (not fake green toast)
- [ ] SSL on all three subdomains
