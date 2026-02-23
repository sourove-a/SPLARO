# SPLARO Hostinger + Google Sheets Runbook (No VPS/AWS)

## Deployment Constraint
- Runtime must be Hostinger Node.js hosting only
- No VPS, no AWS, no separate compute server
- Data persistence can use Google Sheets tabs (`ORDERS`, `USERS`, `SUBSCRIPTIONS`, optional `PRODUCTS`)

## Required Environment Variables
- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- `ADMIN_KEY` (optional minimal admin page)
- `NEXT_PUBLIC_APP_URL`

## Hostinger Setup
1. Connect GitHub repository from Hostinger hPanel Git integration.
2. Set Node.js version supported by current Next.js release (18+).
3. Build command: `npm run build`
4. Start command: `npm run start`
5. Add all env vars in Hostinger environment panel.
6. Enable SSL on domain.

## Google Sheets Setup
1. Create sheet `SPLARO_DB`.
2. Create tabs with exact headers:
   - `ORDERS`
   - `USERS`
   - `SUBSCRIPTIONS`
   - `PRODUCTS` (optional)
3. Share the Google Sheet with service account email as Editor.
4. Store service account credentials only in env vars.
5. Optional premium formatting script:
   - Open Apps Script and paste `/Users/sourove/Desktop/splaro---luxury-footwear-&-bags/docs/google-sheets-premium-format.gs`
   - Run `applyPremiumFormatting` once.

## API Contract Focus
- `/api/signup` -> append to `USERS`
- `/api/order` -> append to `ORDERS`
- `/api/subscribe` -> append to `SUBSCRIPTIONS`
- `/api/health` -> returns uptime/version status

## Reliability Rules
- Zod validation on every payload
- Per-route rate limit for signup/order/subscribe
- Honeypot field on public forms
- Retry for Google API transient failures (3 attempts with backoff)
- Idempotency token for order submission
