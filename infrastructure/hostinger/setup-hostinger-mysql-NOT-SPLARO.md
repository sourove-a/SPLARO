# Hostinger MySQL — phpMyAdmin + .env

SPLARO **API/Admin** uses **PostgreSQL** (`DATABASE_URL`).  
Hostinger **MySQL** is stored separately as `MYSQL_*` for phpMyAdmin and other PHP tools.

## phpMyAdmin login (splaro.co)

1. hPanel → **splaro.co** → **Databases** → **PHP My Admin**
2. Click **Enter phpMyAdmin**
3. If asked manually:

| Field | Value |
|-------|-------|
| Server | `localhost` |
| Database | `u134578371_SPLARO` |
| Username | `u134578371_splaro` |
| Password | (hPanel — same as `MYSQL_PASSWORD` in `.env`) |

Direct link (after hPanel login):  
https://hpanel.hostinger.com/websites/splaro.co/databases/php-my-admin

## Add MySQL to server `.env`

SSH or hPanel terminal:

```bash
cd ~/domains/splaro.co/public_html/.builds/source/repository
bash infrastructure/hostinger/apply-hostinger-mysql-env.sh
```

Or with custom password:

```bash
MYSQL_PASSWORD='7+bJ0:/T' bash infrastructure/hostinger/apply-hostinger-mysql-env.sh
```

Writes to `.env`:

```
# ── HOSTINGER MYSQL (phpMyAdmin — not SPLARO Prisma DATABASE_URL) ──
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=u134578371_SPLARO
MYSQL_USER=u134578371_splaro
MYSQL_PASSWORD="7+bJ0:/T"
MYSQL_URL=mysql://u134578371_splaro:7%2BbJ0%3A%2FT@localhost:3306/u134578371_SPLARO
MYSQL_PHPMYADMIN_URL=https://hpanel.hostinger.com/websites/splaro.co/databases/php-my-admin
```

## hPanel → Environment variables (optional copy-paste)

Add these in **Deployments → Environment variables** (MySQL only — do **not** replace `DATABASE_URL`):

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=u134578371_SPLARO
MYSQL_USER=u134578371_splaro
MYSQL_PASSWORD=7+bJ0:/T
```

## Important

- Do **not** set `DATABASE_URL=mysql://...` — Prisma will fail.
- After MySQL env, still run PostgreSQL setup for SPLARO:

```bash
bash infrastructure/hostinger/setup-local-postgres.sh
bash infrastructure/hostinger/complete-production.sh
```
