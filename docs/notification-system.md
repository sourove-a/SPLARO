# Notification System (PHP + React + Hostinger)

## What is included

- Web push subscription API with VAPID support (`push_public_key`, `push_subscribe`, `push_unsubscribe`)
- Push queue worker with retries and dead-letter behavior (`sync_queue` with `PUSH_SEND` jobs)
- Auto-disable invalid push endpoints (`404`, `410`)
- In-app notification center APIs (`notifications`, `notifications_read`, `notifications_create`, `notifications_click`)
- Campaign APIs (`campaign_create`, `campaign_preview`, `campaign_send`, `campaign_list`, `campaign_logs`)
- Admin subscriber management (`push_subscribers`, `push_subscription_toggle`)
- Health visibility for push system (`/api/index.php?action=health`)
- React components: `NotificationBell`, `SubscriptionPrompt`, `CampaignForm`
- Service worker: `public/push-sw.js`

## Environment variables

Add these to your `.env` / `.env.local`:

```env
PUSH_VAPID_PUBLIC_KEY=
PUSH_VAPID_PRIVATE_KEY=
PUSH_VAPID_SUBJECT=mailto:info@example.com
PUSH_MAX_RETRIES=3
PUSH_BATCH_LIMIT=25
```

Notes:

- `PUSH_MAX_RETRIES=3` means: 1 initial send + 2 retries.
- Private key must be an EC private key PEM string (`ES256`) and can contain escaped `\n`.

## DB migration

Tables are auto-created at runtime by `public/api/index.php` schema guards.

If you maintain SQL manually, apply `public/api/schema.sql` additions:

- `push_subscriptions`
- `notifications`
- `campaigns`
- `campaign_logs`

## Test commands (exact)

Replace placeholders (`<...>`) with real values.

### 1) Health check

```bash
curl -s "https://<your-domain>/api/index.php?action=health"
```

Expected fields in JSON:

- `status=success`
- `push.enabled`
- `push.active_subscriptions`
- `push.queue.pending/retry/dead`

### 2) Create test account

```bash
curl -s -X POST "https://<your-domain>/api/index.php?action=signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Push Test User",
    "email":"push-test-001@example.com",
    "phone":"01700000000",
    "password":"strongpass123"
  }'
```

Expected:

- `status=success`
- `integrations.telegram.queued` appears
- `integrations.push.notification_id` appears (may be `0` if no active subscription)

### 3) Place test order

```bash
curl -s -X POST "https://<your-domain>/api/index.php?action=create_order" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{
    "id":"SPL-TEST-ORDER-01",
    "customerName":"Push Test User",
    "customerEmail":"push-test-001@example.com",
    "phone":"01700000000",
    "district":"Dhaka",
    "thana":"Uttara",
    "address":"Road 1",
    "items":[{"name":"Test Product","quantity":1,"product":{"name":"Test Product","price":1200,"category":"Shoes"}}],
    "total":1320,
    "shippingFee":120,
    "status":"Pending"
  }'
```

Expected:

- `status=success`
- `integrations.telegram.queued` appears
- `integrations.push.notification_id` and `integrations.push.queued_jobs` appear

### 4) Trigger queue processing (manual verification)

```bash
curl -s -X POST "https://<your-domain>/api/index.php?action=process_sync_queue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -d '{"limit":20,"telegram_limit":20,"push_limit":20,"force":true}'
```

Expected response blocks:

- `result.campaigns`
- `result.telegram`
- `result.push`
- `result.sheets`

### 5) Press inline Telegram buttons (order status)

Steps:

1. Open Telegram admin chat.
2. Open an order message with inline status buttons.
3. Tap `Processing`/`Shipped`/`Delivered`/`Cancel`.

Expected:

- Telegram confirms status update.
- `orders.status` updates in MySQL.
- Push + in-app notification is queued for that order user.

### 6) Campaign preview/create/send

Preview:

```bash
curl -s -X POST "https://<your-domain>/api/index.php?action=campaign_preview" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -d '{"target_type":"bought_last_30_days","filters":{"days":30,"url":"/shop"}}'
```

Create + send now:

```bash
curl -s -X POST "https://<your-domain>/api/index.php?action=campaign_create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -d '{
    "title":"Weekend Offer",
    "message":"Flat deal on selected items.",
    "target_type":"subscribed_users",
    "url":"/shop",
    "filters":{"url":"/shop"},
    "send_now":true
  }'
```

## Expected logs (success/failure)

### Success traces

- `integration.order.integration.telegram_queue_result`
- `integration.order.integration.push_queue_result`
- `integration.signup.integration.telegram_queue_result`
- `integration.signup.integration.push_queue_result`
- `integration.push.queue.process.done`
- `integration.campaign.dispatch.done`

### Failure traces

- `integration.push.http.curl.after_exec` (includes `curl_errno` + `curl_error`)
- `integration.push.http.response_decode_failed`
- `integration.push.queue.payload_decode_failed`
- `integration.push.queue.process.done` with `failed/dead`
- `integration.telegram.http.curl.after_exec`
- `integration.telegram.send.failed_attempt`

### Dead-letter behavior

When retries are exhausted:

- `sync_queue.status=DEAD`
- `sync_queue.last_error` populated
- `system_logs.event_type=PUSH_DELIVERY_FAILED` or `TELEGRAM_DELIVERY_FAILED`

## Hostinger deploy note

After frontend build and API edits, prepare deploy folder:

```bash
bash scripts/prepare-public-html.sh
```

This copies `public/api/*` and static assets to `public_html/`.
