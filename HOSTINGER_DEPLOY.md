# SPLARO — Hostinger Production Deploy Guide

Primary deploy path: **GitHub → Hostinger hPanel Git deploy** (no SSH secrets in CI).
`deploy-vps.yml` remains in the repo as a secondary/manual path only.

---

## 1. hPanel Git setup (one time)

hPanel → Websites → **splaro.co** → Advanced → **Git**:

| Setting | Value |
|---|---|
| Repository | `git@github.com:<owner>/SPLARO-BRAND.git` (add the shown deploy key to GitHub → repo → Settings → Deploy keys, read-only) |
| Branch | `main` |
| Node version | **20** |
| Package manager | **npm** |
| Install command | `npm install` (default) |
| Build command | `npm run build` |
| Start command | `npm start` |
| Output/public dir | leave default — `npm start` serves everything via Passenger; `dist` symlink is created by the build for panels that require one |

What happens on push to `main`:
1. hPanel pulls the repo → `npm install` → `npm run build`
   → `scripts/hostinger-build.sh` (env validate → prisma migrate deploy → build web/admin/api → Passenger setup)
2. hPanel runs `npm start` → `scripts/start.mjs` → `infrastructure/hostinger/passenger-stack-app.cjs`
   → reverse proxy on the Passenger port → web `:3001`, API `:4000`, admin `:3002`
3. GitHub Action **Deploy Hostinger (Git)** polls the live URLs and fails loudly if the deploy never becomes healthy.

## 2. DNS (Hostinger DNS zone)

| Record | Type | Value |
|---|---|---|
| `@` | A | Hostinger hosting IP (shown in hPanel) |
| `www` | CNAME | `splaro.co` |
| `admin` | CNAME | `splaro.co` (served by the same Passenger proxy) |
| `api` | CNAME | `splaro.co` — optional; default setup serves the API at `https://splaro.co/api/v1` |

Enable free SSL (hPanel → SSL) for every hostname after DNS propagates.

## 3. Database — use external PostgreSQL

**Recommended: Neon (neon.tech) or Supabase free tier.**
Why not local PostgreSQL on shared hosting: CloudLinux process limits kill background
daemons, storage counts against your 50GB, no automated backups, and every redeploy
risks the DB process. A managed Postgres gives backups, SSL and monitoring for free.

1. Create a project (region: Singapore for BD latency).
2. Copy the connection string, must include `?sslmode=require`.
3. Set it as `DATABASE_URL` in hPanel env vars.

## 4. Environment variables

Copy from [`infrastructure/hostinger/env.production.example`](infrastructure/hostinger/env.production.example)
into hPanel env vars. **Never commit a real `.env`.**

Required (build fails without them — enforced by `scripts/validate-production-env.mjs`):
`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SESSION_SECRET`,
`ENCRYPTION_KEY`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`,
`CORS_ORIGINS`. Generate every secret with `openssl rand -base64 48`.

Placeholders (`change-me`, `your-…`, dev passwords, `localhost` in public URLs) are
rejected at build time. `PAYMENT_DEV_STUB`/`COURIER_DEV_STUB` must be `false`.

## 5. First deploy

```bash
# locally, before pushing:
pnpm check:web && pnpm check:admin && pnpm check:api
FORCE_PRODUCTION_ENV_CHECK=1 pnpm validate:production-env   # against your prod values

git push origin main
```

Then:
1. Watch hPanel → Git Deployment → build log (15–20 min first time).
2. One-time bootstrap: set `SPLARO_RUN_SEED=1` in hPanel env **for the first deploy only**, remove it afterwards.
3. Verify (see §8).

## 6. Redeploy

Just push to `main`. hPanel rebuilds; the GitHub Action verifies the result.
Manual rebuild: hPanel → Git Deployment → Deploy now.

## 7. Rollback

```bash
git revert <bad-commit>   # or: git reset --hard <good-sha> && git push --force-with-lease
git push origin main
```
hPanel redeploys the reverted tree. There is no server-side build cache to clear;
each deploy rebuilds from the pushed source.

## 8. Verification (after every deploy)

```bash
curl -s https://splaro.co -o /dev/null -w '%{http_code}\n'                # 200
curl -s https://splaro.co/api/v1/health                                   # {"status":"ok",...}
curl -s https://admin.splaro.co/login -o /dev/null -w '%{http_code}\n'    # 200
# richer probe suite (from any machine):
API_HEALTH_BASE=https://splaro.co/api/v1 \
WEB_HEALTH_BASE=https://splaro.co \
ADMIN_HEALTH_BASE=https://admin.splaro.co \
  pnpm verify:deploy-health
```

## 9. Common errors

| Symptom | Cause → fix |
|---|---|
| Build killed / "non-unwinding panic" | CloudLinux thread limit — already mitigated (`taskset`, `--v8-pool-size=1`); if it still dies, rebuild once more (transient) |
| Build fails at "production env validation" | Missing/placeholder env var — the log names it; fix in hPanel env, redeploy |
| `prisma migrate deploy` fails | `DATABASE_URL` wrong/unreachable, or migration state diverged. Test connection: `npx prisma db pull`. Never enable `SPLARO_DB_PUSH_ACCEPT_DATA_LOSS` casually |
| API 502 | API process not up — hPanel SSH: `bash infrastructure/hostinger/splaro-start-services.sh`; check `~/pgsql/postgres.log` isn't the issue (external DB avoids this class) |
| Admin can't reach API | `NEXT_PUBLIC_API_URL` / `CORS_ORIGINS` mismatch — must include `https://admin.splaro.co` |
| Telegram delivery fails | `TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_USER_ID` unset or bot not started by the admin user — message the bot once, then redeploy |
| Images not loading | `images.unoptimized` is intentionally on for Hostinger (CPU limits) — image URLs must be directly reachable; check the URL in the browser and `img-src` CSP in `apps/web/next.config.mjs` |
| Build memory fail | `--max-old-space-size` already tuned; disable admin/API build temporarily via `SPLARO_BUILD_ADMIN=0` to isolate which app OOMs |

## 10. Pre-push safety checklist

```bash
pnpm check:web
pnpm check:admin
pnpm check:api
FORCE_PRODUCTION_ENV_CHECK=1 pnpm validate:production-env
# after live:
pnpm verify:deploy-health
```

## Owner must provide (cannot be automated)

- **`DATABASE_URL`** — create the Neon/Supabase project yourself (account ownership).
- **DNS records** — hPanel DNS zone as per §2.
- **Secrets** — generate fresh (`openssl rand -base64 48`), set in hPanel.
- **`TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_USER_ID`** — from @BotFather / @userinfobot.
- Optional: SMTP, Cloudflare R2, Steadfast/Pathao, bKash/SSLCommerz credentials.
