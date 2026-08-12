# @splaro/mcp-server

Enterprise Commerce MCP for SPLARO — catalog, orders, customers, intelligence, and
confirm-gated writes (via Nest API).

## Transports

| Mode | When | Auth |
| --- | --- | --- |
| **stdio** (default) | Cursor, Claude Desktop, Claude Code (local) | Local process; Nest writes need `MCP_API_KEY` or `SPLARO_MCP_SERVICE_TOKEN` in env |
| **HTTP** (`MCP_TRANSPORT=sse`) | ChatGPT / Claude remote connector | **Required** Bearer / `x-mcp-key` link token |

Private remote URL (production):

```text
https://admin.splaro.co/mcp/sse
Authorization: Bearer <token from Admin → AI Command Brain → Private MCP link>
```

Also available: Streamable HTTP at `https://admin.splaro.co/mcp` (same Bearer).

There is **no** public `mcp.splaro.co` subdomain. Admin Next proxies `/mcp/*` →
`127.0.0.1:4005`. Unauthenticated requests get `401`.

## Tools

| Tool | What it answers |
| --- | --- |
| `store_overview` | Morning briefing — today/7-day revenue, action queue, stock and catalog totals |
| `sales_summary` | Revenue, orders, AOV, status breakdown and best-sellers for a period |
| `list_orders` / `get_order` / `find_orders_by_phone` | Orders |
| `search_products` / `get_product` / `low_stock` / `seo_gaps` / `list_taxonomy` | Catalog |
| `get_customer` / `top_customers` | Customers |
| `rma_queue` / `courier_watch` / `abandoned_carts` | Ops queues |
| `assess_cod_risk` / `calculate_unit_economics` / `generate_cart_recovery_message` | Intelligence |
| `update_inventory_stock` / `update_order_status` | Writes — **Nest API**, `confirm: true` required; order status uses `OrderStatusService` |

Money is BDT. Day boundaries are Asia/Dhaka. List tools take `limit` / `offset`.

## Setup (local stdio)

```bash
pnpm install
```

Reads `DATABASE_URL` from `.env.mcp`, then `.env.local`, then `.env`.

Claude Code: root `.mcp.json`. Cursor: `.cursor/mcp.json`.

## Setup (remote HTTP on VPS)

1. Admin → **AI Command Brain** → **Generate link token** (copy once). Owner only.
2. PM2 process `splaro-mcp` is in [`infrastructure/pm2/ecosystem.config.js`](../../infrastructure/pm2/ecosystem.config.js).
   Node **20** is fine (`start.mjs` loads `tsx`); Node 22+ uses native type stripping.
3. Nginx must not buffer `/mcp/` (see `infrastructure/vps/nginx-splaro.co.conf`).
4. ChatGPT / Claude connector:

```text
URL: https://admin.splaro.co/mcp/sse
Header: Authorization: Bearer splaro_mcp_…
```

5. Writes are allowlisted on Nest: order status + product variant stock only (`confirm: true`).
6. Revoke leaked tokens from the same admin panel.

Local HTTP smoke:

```bash
pnpm mcp:sse
curl -s http://127.0.0.1:4005/health
curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer bad' http://127.0.0.1:4005/sse
```

(401 expected for bad bearer. `/health` works even if Postgres is briefly down.)

## Pointing stdio at production DB

Do **not** expose Postgres. SSH tunnel + `.env.mcp`:

```bash
ssh -N -L 55432:127.0.0.1:5432 user@your-host
```

## Checks

```bash
pnpm --filter @splaro/mcp-server smoke
pnpm --filter @splaro/mcp-server type-check
```

Smoke keeps write tools on `confirm: false` (dry-run). Live `confirm: true` needs Nest `:4000` + a valid MCP bearer.

## Privacy

Tool results include customer PII. A link token is store-ops power — treat like a password and revoke if leaked.
