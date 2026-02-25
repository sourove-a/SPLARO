# System Health (Admin)

## Endpoints

- `GET /api/index.php?action=health`
- `POST /api/index.php?action=health_probe`
- `GET /api/index.php?action=health_events&limit=50&probe=db`
- `GET /api/index.php?action=system_errors&limit=50&service=HEALTH_DB&level=ERROR`

All endpoints require admin authentication (`Authorization` bearer or `X-Admin-Key`), and `health_probe` requires `X-CSRF-Token`.

## Probe Payload

```json
{ "probe": "db" }
```

Allowed probes:

- `db`
- `telegram`
- `sheets`
- `queue`
- `orders`
- `auth`

## Sample cURL

```bash
curl -sS "https://YOUR_DOMAIN/api/index.php?action=health" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

```bash
curl -sS -X POST "https://YOUR_DOMAIN/api/index.php?action=health_probe" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"probe":"telegram"}'
```

## What To Expect In Logs

- Structured probe/result traces in `error_log` with `SPLARO_LOG`.
- Failures mirrored into `system_errors` with:
  - `service`
  - `level`
  - `message`
  - `context_json` (redacted)
- Probe runs recorded in `health_events` with latency and error text.

