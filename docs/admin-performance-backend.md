# Admin Backend Performance Layer (Next.js, Hostinger)

## What was implemented
- Cache interface with Redis-first fallback to in-memory:
  - `lib/cache.ts`
  - `get`, `set`, `del`, `wrap`
- Snapshot/materialized view strategy:
  - `lib/snapshotStore.ts`
  - Disk snapshot at `.cache/admin-sheet-snapshot.json`
  - Refresh scheduler every 1-5 minutes (configurable)
  - Stale-while-revalidate behavior
  - Refresh concurrency lock
- Google Sheets access layer:
  - `lib/sheets.ts`
  - 5s timeout, retry x2 with backoff
  - batch tab reads for `ORDERS`, `USERS`, `SUBSCRIPTIONS`
- Fast paginated admin endpoints:
  - `GET /api/admin/orders?page=&pageSize=&q=&status=`
  - `GET /api/admin/users?page=&pageSize=&q=`
  - `GET /api/admin/subscriptions?page=&pageSize=&q=`
  - `GET /api/admin/metrics`
  - `PATCH /api/admin/orders/status`
- Security and admin protection:
  - header-based `ADMIN_KEY` checks
  - middleware for `/api/admin/*`
  - in-memory admin rate limit per endpoint
  - audit log file for status updates
- Observability:
  - structured logs with `requestId`, duration, `cache_hit`, `snapshot_age_seconds`
  - Sheets call latency logs

## Required packages in your Next.js project
- `next`
- `zod`
- `googleapis`
- `redis` (optional for `REDIS_URL`, fallback cache works without it)

## Cache Keys
- `orders:list:page:<n>:size:<m>:q:<...>:status:<...>`
- `users:list:page:<n>:size:<m>:q:<...>:status:`
- `subs:list:page:<n>:size:<m>:q:<...>:status:`
- `orders:count`
- `users:count`
- `subs:count`
- `orders:lastUpdatedAt`

## TTL
- List caches: 45s
- Count caches: 90s

## Notes
- Admin endpoints never read Google Sheets directly on every request.
- Requests serve from cache/snapshot first and trigger background refresh when stale.
- If Sheets refresh fails, last good snapshot keeps serving.
