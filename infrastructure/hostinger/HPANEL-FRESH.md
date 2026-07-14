# Hostinger Fresh Deploy — GitHub auto (splaro.co)

Apni file delete korechen — thik. Ekhon **shudhu GitHub push** korlei hobe.

## Database — IMPORTANT (2 ta alada)

| Database | Ki kaje | Kothay |
|----------|---------|--------|
| **PostgreSQL** | SPLARO app — orders, products, **admin login** | Auto-install build e (lagbe na manually) |
| **MySQL** `u134578371_SPLARO` | phpMyAdmin / backup only | hPanel MySQL — **Prisma use kore na** |

Admin panel login PostgreSQL theke ashe, MySQL theke na.

---

## 1. hPanel → splaro.co → Deployments

| Setting | Value |
|---------|--------|
| Repository | `sourove-a/SPLARO` → branch **`main`** |
| Auto deploy | **ON** |
| Framework | Express |
| Package manager | **npm** |
| Node.js | 20 |
| Build | `npm run build` |
| Start | `npm start` |
| Output | `dist` (symlink — Passenger uses `domains/splaro.co/nodejs/app.cjs`) |

## 2. hPanel → Environment variables (copy-paste)

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://splaro.co
NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co
NEXT_PUBLIC_API_URL=https://splaro.co/api/v1
NEXT_PUBLIC_CDN_URL=https://splaro.co
WEB_URL=https://splaro.co
ADMIN_URL=https://admin.splaro.co
API_URL=https://splaro.co
CORS_ORIGINS=https://splaro.co,https://admin.splaro.co
NEXT_PUBLIC_STORE_ID=splaro
ADMIN_EMAIL=splaro.bd@gmail.com
NEXT_PUBLIC_ADMIN_EMAIL=splaro.bd@gmail.com
REDIS_ENABLED=false
API_PORT=4000
INTERNAL_WEB_PORT=3001
ADMIN_PORT=3002
PAYMENT_DEV_STUB=false

# MySQL (hPanel — verified on build, phpMyAdmin only)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=u134578371_SPLARO
MYSQL_USER=u134578371_splaro
MYSQL_PASSWORD=YOUR_MYSQL_PASSWORD_FROM_HPANEL

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ADMIN_USER_ID=1997983081
TELEGRAM_STORE_SLUG=splaro
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=splaro_bot

# Secrets (generate: openssl rand -base64 48)
JWT_SECRET=change-me-min-32-chars-random-string-here
JWT_REFRESH_SECRET=change-me-min-32-chars-random-string-here
ADMIN_SESSION_SECRET=change-me-min-32-chars-random-string-here
ENCRYPTION_KEY=change-me-min-32-chars-random-string-here
REVALIDATE_SECRET=change-me-16-chars-min
INTERNAL_HEALTH_SECRET=change-me-16-chars-min
```

**DATABASE_URL lagbe na** — build automatically PostgreSQL install + seed korbe.

## 3. Push

```bash
git push origin main
```

## 4. Build log e dekhben

```
[sync-hpanel-env] .env synced
[mysql-env] MySQL connection test: OK
[setup-pg] PostgreSQL ready
Created admin user: splaro.bd@gmail.com
[hostinger-build] Web build OK
[hostinger-build] Admin build OK
[hostinger-build] API build OK
[start] Hostinger Git deploy → passenger-stack-app
```

## 5. Admin login

- URL: https://admin.splaro.co/login
- Email: `splaro.bd@gmail.com`
- Token: Telegram @splaro_bot → `/login` → Copy Token (5 min)

## 6. Verify

- https://splaro.co → 200
- https://splaro.co/api/v1/health → ok
- https://admin.splaro.co/login → 200

## DNS (hPanel)

| Name | Type | Value |
|------|------|-------|
| `@` | A | server IP |
| `admin` | A | server IP |

---

**Purono domain soriye splaro.co use hobe** — code + seed + admin e update kora hoyeche.
