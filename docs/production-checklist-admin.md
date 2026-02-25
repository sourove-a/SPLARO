# SPLARO Production Checklist (Admin + Reliability)

## 1) Health Endpoint
```bash
curl -sS "https://admin.splaro.co/api/index.php?action=health" \
  -H "Authorization: Bearer <ADMIN_AUTH_TOKEN>" \
  -H "X-Admin-Key: <ADMIN_KEY>"
```

Expected:
- `status=success`
- `mode` is `NORMAL` or `DEGRADED`
- `services.db/orders_api/auth_api/queue/telegram/sheets/push` present
- `health_events` and `recent_errors` arrays present

## 2) Create Test Account
```bash
curl -sS "https://admin.splaro.co/api/index.php?action=signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Health Test User",
    "email":"health-test-user+'$(date +%s)'@example.com",
    "phone":"01700000000",
    "password":"TestPass123"
  }'
```

Expected:
- `status=success`
- `token` present
- `integrations.sheets.queued` present
- `integrations.telegram.queued` present

## 3) Place Test Order (Authenticated User)
```bash
curl -sS "https://admin.splaro.co/api/index.php?action=create_order" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_AUTH_TOKEN>" \
  -d '{
    "customerName":"Health Test User",
    "customerEmail":"health-test-user@example.com",
    "phone":"01700000000",
    "district":"Dhaka",
    "thana":"Uttara",
    "address":"Test Address",
    "shippingFee":0,
    "discountAmount":0,
    "total":1000,
    "status":"Pending",
    "items":[
      {
        "quantity":1,
        "product":{
          "id":"<EXISTING_PRODUCT_ID>",
          "name":"Test Product",
          "price":1000,
          "brand":"Test",
          "category":"Shoes",
          "productSlug":"test-product"
        }
      }
    ]
  }'
```

Expected:
- `status=success`
- `order_id` and `order_no` present
- `integrations.sheets/telegram/push` present
- If insufficient stock: `status=error`, `message=INSUFFICIENT_STOCK`

## 4) Telegram Inline Button Status Update
- Open Telegram admin chat.
- Press order inline button (`Processing`, `Shipped`, `Delivered`, etc.).

Expected:
- Callback answer toast in Telegram (`Updated: <STATUS>`)
- Message refresh includes updated status
- MySQL `orders.status` updated
- `order_status_history` appended

## 5) Logs to Confirm (Success/Failure)
Watch Hostinger/PHP error log for these structured markers:
- Success flow:
  - `integration.order.db.insert.committed`
  - `integration.signup.integration.telegram_queue_result`
  - `integration.telegram.queue.job.result`
  - `integration.sheets.queue.job.success`
- Failure flow:
  - `integration.telegram.http.curl.after_exec` (contains `curl_errno`, `curl_error`)
  - `integration.*.payload_decode_failed` (contains `json_error`)
  - `SPLARO_ORDER_CREATE_FAILURE`
  - `system_errors` table row with `service`, `message`, `context_json`

## 6) Dead Queue Recovery
```bash
curl -sS "https://admin.splaro.co/api/index.php?action=recover_dead_queue" \
  -X POST \
  -H "Authorization: Bearer <ADMIN_AUTH_TOKEN>" \
  -H "X-Admin-Key: <ADMIN_KEY>" \
  -H "X-CSRF-Token: <CSRF_COOKIE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"ALL","limit":300,"drain":true}'
```

Expected:
- `status=success`
- `result.recovered` >= 0
- queue totals improve (`dead/retry` decrease)
