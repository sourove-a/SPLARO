# Next.js 15 Full Migration Steps (SPLARO)

## 1) Runtime and entrypoint

1. Set `package.json` scripts to Next runtime:
   - `dev`: `next dev`
   - `build`: `next build`
   - `start`: `next start`
2. Add `next.config.mjs` and `next-env.d.ts`.
3. Update `tsconfig.json` for Next (`jsx: preserve`, Next plugin, `.next/types` includes).

## 2) App Router shell

1. Add `app/layout.tsx` with global metadata and runtime bootstrap.
2. Add `app/globals.css` and move global styles from `index.html`.
3. Add `app/[[...slug]]/page.tsx` to host the storefront/admin client shell.
4. Add `components/NextAppClient.tsx` to lazy mount existing app shell safely.

## 3) API migration to route handlers

1. Keep modern route handlers under `app/api/**/route.ts`.
2. Add compatibility endpoint `app/api/index.php/route.ts` to preserve legacy `?action=` calls.
3. Add aliases:
   - `app/api/signup/route.ts`
   - `app/api/order/route.ts`
4. Ensure auth/admin middleware remains active via `middleware.ts` for `/api/admin/*`.

## 4) Env/runtime migration

1. Replace `import.meta.env` usage with Next/public runtime resolver (`lib/runtime.ts`).
2. Use `NEXT_PUBLIC_*` variables for frontend runtime values.
3. Keep backend envs server-side only (`DB_*`, `SMTP_*`, `ADMIN_KEY`, etc).

## 5) Data/schema compatibility

1. Keep Prisma/MySQL stack intact.
2. Extend runtime schema guards in `lib/migrate.ts` for missing legacy fields required by dashboard/auth.
3. Keep existing tables backward-compatible to avoid data loss.

## 6) Deploy checklist (Hostinger Node)

1. Run:
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - `npm run build`
2. Set start command to `npm run start`.
3. Verify:
   - `/api/health`
   - `/api/status`
   - `/api/index.php?action=health`
   - `/api/index.php?action=sync`

## 7) Post-migration cleanup (safe, optional)

1. Mark `public/api` and `public_html` as legacy references.
2. Remove Vite-only artifacts after rollout freeze:
   - `vite.config.ts`
   - `index.html`
   - `index.tsx`
3. Keep compatibility endpoint until all frontend calls migrate away from `?action=...`.
