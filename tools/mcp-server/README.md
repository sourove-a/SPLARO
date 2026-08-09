# @splaro/mcp-server

A **read-only** MCP server that lets a local AI client (Claude Code, Claude Desktop, Cursor)
query the SPLARO store database directly — catalog, orders, customers and sales.

It runs over **stdio only**. There is no HTTP listener, no port and no public subdomain, so it
adds nothing to the production attack surface. It also cannot write: every Prisma delegate is
wrapped in a proxy that refuses `create*`, `update*`, `delete*`, `upsert*` and all raw query
methods, so a bad prompt or a bug cannot mutate the store. Edits still go through the admin panel.

## Tools

| Tool | What it answers |
| --- | --- |
| `store_overview` | Morning briefing — today/7-day revenue, action queue, stock and catalog totals |
| `sales_summary` | Revenue, orders, AOV, status breakdown and best-sellers for a period |
| `list_orders` | Orders by status, payment status, date range or search term |
| `get_order` | One order in full — items, payments, courier, status history, customer |
| `find_orders_by_phone` | COD verification — order history behind a Bangladeshi phone number |
| `search_products` | Catalog search by name, slug, SKU or RM code |
| `get_product` | One product in full — every variant, stock, pricing, SEO meta |
| `low_stock` | Variants at or below their restock threshold |
| `inventory_history` | Stock movements for one product — what changed it and why |
| `seo_gaps` | Live products missing meta title, meta description, copy or images |
| `list_taxonomy` | Categories and collections with product counts (valid `categorySlug` values) |
| `get_customer` | One customer — lifetime stats, addresses, recent orders |
| `top_customers` | Customers ranked by lifetime spend, orders or recency |
| `rma_queue` | Returns, exchanges and repairs still waiting on a decision |
| `courier_watch` | Shipments booked but not delivered, with age and failure reason |
| `abandoned_carts` | Quiet carts that still hold items, with recoverable value |

Money is BDT. Day boundaries are Asia/Dhaka. Revenue totals exclude `CANCELLED`, `RETURNED`
and `REFUNDED` orders. List tools take `limit` and `offset` and report a `total`, so the model
can page through results rather than silently seeing only the first slice.

## Setup

Dependencies come from the workspace install:

```bash
pnpm install
```

The server reads `DATABASE_URL` from the repo root, checking `.env.mcp`, then `.env.local`,
then `.env`. It connects to whatever that URL points at — by default the local development
database.

Choose the store with `SPLARO_MCP_STORE_ID` (an id or a slug). Without it, the server falls
back to `NEXT_PUBLIC_STORE_ID`, then to the oldest active store.

### Pointing at production

Do **not** expose the production database to the internet for this. Open an SSH tunnel first,
then point a `.env.mcp` at the tunnel:

```bash
ssh -N -L 55432:127.0.0.1:5432 user@your-host
```

Then copy `.env.mcp.example` at the repo root to `.env.mcp` (gitignored) and point
`DATABASE_URL` at the tunnel.

## Using it

Claude Code picks the server up automatically from the repo's `.mcp.json`.

**Cursor** does not read root `.mcp.json`. It loads project MCP from `.cursor/mcp.json`
(already in this repo: stdio, repo-root `cwd`, entry = `tools/mcp-server/start.mjs`).
After opening this workspace, `splaro` should appear under Cursor Settings → MCP. Project
servers often start **disconnected** until you toggle them on once. If `node` is only on
nvm/fnm PATH, Cursor’s GUI spawn uses `/bin/zsh` + `nvm.sh` (stdout stays clean for MCP).
Do not add a public URL or `mcp.splaro.co`.

Claude Desktop can reuse the same stdio command with an explicit repo-root `cwd`:

```json
{
  "mcpServers": {
    "splaro": {
      "command": "node",
      "args": [
        "--disable-warning=ExperimentalWarning",
        "/ABSOLUTE/PATH/TO/SPLARO-BRAND/tools/mcp-server/start.mjs"
      ],
      "cwd": "/ABSOLUTE/PATH/TO/SPLARO-BRAND"
    }
  }
}
```

Then ask things like "aja koto order?", "which sizes need reordering?", "pull up SPL-1005",
"has 01871221201 ordered before?".

## Checks

```bash
pnpm --filter @splaro/mcp-server smoke
```

Runs every tool against the configured database and asserts that the read-only guard blocks a
write. It fails if a registered tool has no smoke case, so new tools cannot ship untested.
Type-check with `pnpm --filter @splaro/mcp-server type-check`.

There is no build step — Node 22 runs the TypeScript sources directly via type stripping.

## Privacy

Tool results include customer names, phone numbers, addresses and order values, and they are
sent to whichever AI client you connect. Keep this server local; do not wire it to a shared or
hosted client.
