<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SPLARO Codebase

Current branch contains the existing storefront app and a full enterprise migration blueprint for Next.js App Router.

## Enterprise Blueprint (New)
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/enterprise-architecture.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/route-map-and-api.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/critical-flows.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/security-scale-deploy.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/migration-and-seed-plan.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/environment-variables.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/implementation-roadmap.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/hostinger-google-sheets-runbook.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/telegram-admin-bot.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/admin-performance-backend.md`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/prisma/schema.prisma`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/prisma/seed.ts`
- `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/.env.example`

## Current App (Vite) Run Locally
Prerequisite: Node.js

1. `npm install`
2. `npm run dev`

## Added Next.js Admin Backend Layer
- New route handlers are under `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/app/api/admin/`
- Shared performance modules are under `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/lib/`
- Read `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/admin-performance-backend.md` before wiring into your Next.js App Router project.

## Added Next.js Transaction Backend (Hostinger MySQL + SMTP)
- New API routes:
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/app/api/signup/route.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/app/api/order/route.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/app/api/subscribe/route.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/app/api/health/route.ts`
- New backend modules:
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/lib/prisma.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/lib/mailer.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/lib/telegram.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/lib/password.ts`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/lib/apiValidators.ts`
- Prisma now targets MySQL for Hostinger:
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/prisma/schema.prisma`
  - `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/prisma/migrations/20260220_init_mysql/migration.sql`

### Prisma Commands
1. `npm install`
2. `npm run prisma:generate`
3. `npm run prisma:migrate`
4. `npm run prisma:seed`

## User Dashboard UX + Security Refactor
- Updated dashboard UI: `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/components/UserDashboard.tsx`
  - Password change moved to a hidden secure modal (default closed).
  - Added sections: Profile, Order History, Account Security, Preferences, Support.
  - Added active session list, 2FA toggle, logout-all-sessions action.
- Updated backend security/actions: `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/public/api/index.php`
  - New actions: `csrf`, `user_sessions`, `logout_all_sessions`, `toggle_two_factor`, `update_preferences`, `create_support_ticket`.
  - Hardened actions with CSRF and rate limits: `change_password`, `update_profile`.
  - Added audit/system logs for password/security/profile/preference/session/ticket events.
  - Added `last_password_change_at` + `force_relogin` handling in password flows.

## Storefront CMS + Theme Controls
- Hero typography hardened in `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/components/ShopPage.tsx`
  - Balanced responsive headline wrapping.
  - Manual line-break support using `\n` or `<br>` in CMS.
  - Category-specific hero overrides (all/shoes/bags).
- Theme settings and Hero CMS editor added in `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/components/AdminPanel.tsx`
  - Draft and Publish actions with revision list.
  - Role-aware guard (Viewer blocked; Editor can edit CMS, not protocol settings).
- Settings model extended in `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/types.ts` and `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/store.tsx`
  - `cmsDraft`, `cmsPublished`, `cmsActiveVersion`, `cmsRevisions`.
  - `themeSettings`, `heroSettings`, `categoryHeroOverrides`.
- Backend persistence upgraded in `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/public/api/index.php`
  - Added DB tables: `page_sections`, `settings_revisions`.
  - `update_settings` now stores CMS draft/publish bundles + revision history.
  - `sync` returns normalized CMS bundle for storefront rendering.
