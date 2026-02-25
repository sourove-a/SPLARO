# SPLARO Production Reliability Hardening

## Hostinger-safe runtime settings

Use these environment variables in deployment:

```env
DB_CONNECT_TIMEOUT_SECONDS=5
DB_QUERY_TIMEOUT_MS=3500
DB_LOCK_WAIT_TIMEOUT_SECONDS=10
DB_IDLE_TIMEOUT_SECONDS=90
DB_RETRY_MAX=3
DB_RETRY_BASE_DELAY_MS=120
DB_SLOW_QUERY_MS=900
DB_PERSISTENT=false
DB_POOL_TARGET=6
API_MAX_EXECUTION_SECONDS=25
LOG_REQUEST_METRICS=true
GOOGLE_SHEETS_TIMEOUT_SECONDS=5
GOOGLE_SHEETS_MAX_RETRIES=5
GOOGLE_SHEETS_CIRCUIT_BREAK_SECONDS=600
```

## What is hardened now

- DB connection retries transient failures only (max 3 with exponential backoff).
- Fatal DB auth/config errors are not retried.
- Session-level DB protections are applied:
  - `innodb_lock_wait_timeout`
  - `wait_timeout` / `interactive_timeout`
  - `MAX_EXECUTION_TIME` with MariaDB fallback (`max_statement_time`)
- Sync queue keeps external Sheet delays away from core order/signup flows.
- External API calls use connect timeout + total timeout + low-speed protection.
- Health endpoint runs `SELECT 1` ping and returns latency and timeout profile.
- Structured logs include request duration and DB connection metadata.
- Slow query warnings are emitted when query duration exceeds `DB_SLOW_QUERY_MS`.

## Slow query visibility

If Hostinger does not allow global MySQL slow-log settings, use application logs:

- watch `SPLARO_LOG` events with `event=db.slow_query`.
- tune `DB_SLOW_QUERY_MS` down/up based on observed load.

If MySQL privileges allow session tuning, optional:

```sql
SET SESSION long_query_time = 1;
```

## Operations checklist

1. Confirm `/api/index.php?action=health` shows:
   - `"storage":"mysql"`
   - `"mode":"NORMAL"`
   - `"db.ping":"ok"`
2. Confirm admin sync returns `"storage":"mysql"`.
3. Confirm dead Sheet jobs are retried from queue (`sync_queue` table).
4. Confirm `SPLARO_LOG` request duration entries are written.
5. Review slow query warnings and add indexes if repeated.

