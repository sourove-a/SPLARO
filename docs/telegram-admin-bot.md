# SPLARO Telegram Admin Control (Hostinger)

## Security First
1. Regenerate your bot token in BotFather before deployment.
2. Put token only in Hostinger env (`TELEGRAM_BOT_TOKEN`).
3. Set allowlisted admin chat id (`TELEGRAM_CHAT_ID`).
4. Set webhook secret (`TELEGRAM_WEBHOOK_SECRET`).

## Webhook Setup
Use Telegram setWebhook API:

```bash
https://api.telegram.org/bot<NEW_TOKEN>/setWebhook?url=https://your-domain.com/api/index.php?action=telegram_webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## Available Bot Commands
- `/help`
- `/health`
- `/orders [limit]`
- `/order {order_id}`
- `/setstatus {order_id} {PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED}`
- `/users [limit]`
- `/maintenance {on|off}`

## Website -> Telegram Notifications
- New order (`create_order`)
- New signup (`signup`)
- New subscriber (`subscribe`)
- Order status updated (`update_order_status`)

## Notes
- Only allowlisted chat id can execute admin commands.
- Webhook secret is validated from Telegram header.
- Rate limiting and honeypot checks are enabled for public submission APIs.
