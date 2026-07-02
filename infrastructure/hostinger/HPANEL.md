# Hostinger Git Deploy (splaro.co)

Hostinger shared Node.js **cannot use pnpm via Corepack** — it crashes with:

`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` (corepack pnpm 11.x on Alt-NodeJS).

## hPanel settings (Deployments → Settings → Redeploy)

| Setting | Value |
|---------|--------|
| **Package manager** | **npm** (not pnpm) |
| **Node.js** | 20.x |
| **Framework** | Other |
| **Root directory** | `/` (repo root) |
| **Build command** | `bash scripts/hostinger-build.sh` |
| **Start command** | `node apps/web/.next/standalone/apps/web/server.js` |
| **Output directory** | `apps/web/.next/standalone/apps/web` |
| **Port** | 3000 (default) |

## Environment variables

Import production `.env` in hPanel (Deployments → Environment variables).

Minimum for storefront build/runtime:

- `NODE_ENV=production`
- `NEXT_PUBLIC_SITE_URL=https://splaro.co`
- `NEXT_PUBLIC_API_URL=https://api.splaro.co/api/v1`
- `NEXT_PUBLIC_ADMIN_URL=https://admin.splaro.co`

API/admin on separate subdomains need **VPS** or separate Hostinger Node apps — see `deploy-remote.sh`.

## After changing settings

1. Save settings
2. Click **Redeploy**
3. Build logs should show `[ensure-pnpm] OK — pnpm 9.4.0` then `pnpm install`

## Full stack (web + admin + API + PostgreSQL)

Use **Hostinger KVM VPS** + `infrastructure/hostinger/deploy-remote.sh`, not shared Git deploy.

### VPS deploy (recommended)

1. Clone repo to `~/splaro` on the VPS
2. Copy `.env` from `infrastructure/hostinger/.env.splaro.co.production` or run:
   `bash infrastructure/hostinger/generate-production-env.sh > ~/splaro/.env`
3. Set `DATABASE_URL` — local Postgres on VPS **or** Neon/Supabase for managed DB
4. Run: `bash infrastructure/hostinger/deploy-remote.sh`

The script runs `pnpm build:all`, `prepare-next-standalone` for web + admin, then PM2 reload.

PM2 starts:
- `apps/web/.next/standalone/apps/web/server.js` on :3000
- `apps/admin/.next/standalone/apps/admin/server.js` on :3001
- `apps/api/dist/main.js` on :4000

### SSH blocked from Mac?

If `ssh -p 65002` times out:

1. hPanel → **Advanced → SSH Access** → enable, verify IP/port
2. Try mobile hotspot (ISP may block port 65002)
3. **hPanel Browser Terminal** (no local SSH):
   ```bash
   cd ~/splaro && git pull origin main && bash infrastructure/hostinger/deploy-remote.sh
   ```
4. GitHub Actions workflow with `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSHPASS` secrets

### Production env notes

- Set `PAYMENT_DEV_STUB=false` for real bKash/Nagad/SSLCommerz
- Set `NEXT_PUBLIC_CDN_URL` if product images are on R2/CDN (`/uploads` rewrite uses this)
- Never commit real `.env` — use `generate-production-env.sh` for random secrets
