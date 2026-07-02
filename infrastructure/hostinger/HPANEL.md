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
