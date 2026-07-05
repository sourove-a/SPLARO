# SPLARO VPS — Complete Setup + GitHub Auto-Deploy

Hostinger KVM VPS ba onno Ubuntu VPS e full SPLARO stack + GitHub theke auto deploy.

---

## Docker lagbe ki?

| Component | Docker? | Recommendation |
|-----------|---------|----------------|
| **web, admin, api, worker** | ❌ No | PM2 diye native run (Next.js + NestJS) |
| **PostgreSQL + Redis** | Optional | Default: native install (apt). Docker chaile: `USE_DOCKER_DB=true` |
| **Nginx, SSL, Node** | ❌ No | Native install |

**Short answer:** Full app Docker e dorkar **na**. Shudhu DB Docker e rakhte chaile `docker-compose.prod.yml` use koro.

---

## Ki ki install hobe (auto)

`install-stack.sh` ba `go-live.sh` eigula install kore:

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x | Next.js + NestJS |
| pnpm | 9.x | Monorepo packages |
| PM2 | latest | Process manager (web, admin, api, worker) |
| PostgreSQL | 16 | Orders, products, admin auth |
| Redis | 7 | Cache, worker queue |
| Nginx | latest | Reverse proxy + SSL |
| Certbot | latest | Let's Encrypt SSL |
| Git | latest | GitHub pull |
| UFW + fail2ban | — | Security |

Optional Docker (DB only):
```bash
USE_DOCKER_DB=true bash infrastructure/vps/install-stack.sh
```

---

## Complete Process (3 phase)

### Phase 1 — Mac theke prep

```bash
cd ~/Desktop/Website/SPLARO-BRAND
pnpm prep:vps
nano infrastructure/vps/.env.production.generated
# TELEGRAM_BOT_TOKEN, bKash, Steadfast add koro
```

### Phase 2 — VPS first deploy

**DNS first** (hPanel):

| Type | Name | Value |
|------|------|-------|
| A | `@` | VPS IP |
| A | `www` | VPS IP |
| A | `admin` | VPS IP |

**VPS e:**

```bash
ssh root@YOUR_VPS_IP

# Option A — one command go-live
git clone https://github.com/sourove-a/SPLARO.git /var/www/splaro
# Mac theke .env upload:
# scp infrastructure/vps/.env.production.generated root@VPS:/var/www/splaro/.env
bash /var/www/splaro/infrastructure/vps/go-live.sh
```

`go-live.sh` automatically:
1. Stack install (Node, Postgres, Redis, Nginx, PM2)
2. Build + migrate + seed
3. SSL certificate
4. PM2 start
5. **GitHub deploy keys generate** (setup-github-deploy.sh)

Go-live sheshe terminal e **GitHub secrets** ar **deploy key** dekhabe — copy koro.

### Phase 3 — GitHub auto-deploy connect

#### A. GitHub Secrets (recommended — primary method)

GitHub → `sourove-a/SPLARO` → **Settings → Secrets and variables → Actions → New secret**

| Secret | Value |
|--------|-------|
| `VPS_SSH_HOST` | VPS IP (e.g. `145.79.25.203`) |
| `VPS_SSH_USER` | `root` |
| `VPS_SSH_PORT` | `22` (Hostinger shared SSH hole 65002) |
| `VPS_SSH_PRIVATE_KEY` | `setup-github-deploy.sh` output theke full private key |

#### B. GitHub Deploy Key (VPS git pull er jonno)

GitHub → **Settings → Deploy keys → Add deploy key**

- Title: `splaro-vps-read`
- Key: `setup-github-deploy.sh` output er public key
- ✅ Allow read access only

#### C. Test auto-deploy

```bash
git push origin main
```

GitHub Actions → **Deploy VPS** workflow run korbe:
1. SSH → VPS
2. `git pull` + build + PM2 reload
3. Live smoke test

---

## Auto-deploy flow

```
git push main
    ↓
GitHub Actions (deploy-vps.yml)
    ↓
SSH root@VPS
    ↓
bash infrastructure/vps/deploy.sh
    ↓
git pull → pnpm install → build → pm2 reload
    ↓
https://splaro.co live ✅
```

---

## Webhook backup (optional)

GitHub Actions SSH na thakle webhook use koro:

```bash
# VPS e (setup-github-deploy.sh output dekhe):
systemctl enable splaro-webhook
systemctl start splaro-webhook
```

GitHub → Webhooks → Add:
- URL: `http://YOUR_VPS_IP:9000/hook` (nginx reverse proxy recommended)
- Secret: setup script output
- Events: Push

---

## Daily commands

```bash
# Manual redeploy
ssh root@VPS "bash /var/www/splaro/infrastructure/vps/deploy.sh"

# Status
pm2 status
pm2 logs splaro-api --lines 50

# Verify from Mac
pnpm verify:production
```

---

## Production checklist

- [ ] DNS `@`, `www`, `admin` → VPS IP
- [ ] `.env` — TELEGRAM, bKash, Steadfast keys
- [ ] `PAYMENT_DEV_STUB=false`
- [ ] SSL active (https://splaro.co)
- [ ] GitHub Secrets set (4 ta)
- [ ] Deploy key added (read-only)
- [ ] `git push origin main` → Actions green
- [ ] Admin login: splaro.bd@gmail.com + Telegram token

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Actions SSH fail | VPS_SSH_HOST/PORT/KEY check; ufw allow 22 |
| git pull fail | Deploy key add koro GitHub e |
| Build OOM | VPS minimum 8GB RAM |
| Certbot fail | DNS wait 30 min, retry certbot |
| pm2 not found | `npm install -g pm2` |

---

## File reference

| File | Purpose |
|------|---------|
| `infrastructure/vps/install-stack.sh` | Software install |
| `infrastructure/vps/go-live.sh` | First deploy |
| `infrastructure/vps/deploy.sh` | Redeploy (auto + manual) |
| `infrastructure/vps/setup-github-deploy.sh` | GitHub keys |
| `.github/workflows/deploy-vps.yml` | Auto-deploy workflow |
| `docker-compose.prod.yml` | Optional Docker DB |
