/**
 * Exercises every tool against the configured database without going through
 * the MCP protocol, so failures show up as plain stack traces.
 *
 *   pnpm --filter @splaro/mcp-server smoke
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAnalyticsTools } from '../src/tools/analytics.ts'
import { registerCatalogTools } from '../src/tools/catalog.ts'
import { registerOperationsTools } from '../src/tools/operations.ts'
import { registerOrderTools } from '../src/tools/orders.ts'
import { prisma, storeId } from '../src/prisma.ts'

type ToolEntry = { handler: (args: unknown, extra: unknown) => Promise<unknown> }

const server = new McpServer({ name: 'splaro-smoke', version: '1.0.0' })
registerCatalogTools(server)
registerOrderTools(server)
registerOperationsTools(server)
registerAnalyticsTools(server)

// _registeredTools is internal to the SDK; the smoke test is the only caller.
const registry = (server as unknown as { _registeredTools: Record<string, ToolEntry> })
  ._registeredTools

/**
 * The detail tools need a real id to say anything, so the fixtures come from
 * the database instead of being hard-coded.
 */
async function fixtures(store: string) {
  const [product, order, customer] = await Promise.all([
    prisma().product.findFirst({ where: { storeId: store }, select: { slug: true } }),
    prisma().order.findFirst({ where: { storeId: store }, select: { invoiceNumber: true } }),
    prisma().customer.findFirst({ where: { storeId: store }, select: { id: true } }),
  ])
  return {
    productSlug: product?.slug ?? null,
    invoice: order?.invoiceNumber ?? null,
    customerId: customer?.id ?? null,
  }
}

function buildCases(f: Awaited<ReturnType<typeof fixtures>>): Array<[string, Record<string, unknown>]> {
  return [
    ['store_overview', {}],
    ['sales_summary', { period: 'month' }],
    ['sales_summary', { period: 'custom', from: '2026-01-01', to: '2026-12-31', topProducts: 0 }],
    ['search_products', { limit: 3 }],
    ['search_products', { limit: 2, offset: 2 }],
    ['low_stock', { limit: 5 }],
    ['low_stock', { threshold: 3, limit: 5, offset: 1 }],
    ['seo_gaps', { limit: 5 }],
    ['list_orders', { limit: 3 }],
    ['list_orders', { status: 'PENDING', limit: 3, offset: 0 }],
    ['top_customers', { limit: 3 }],
    ['find_orders_by_phone', { phone: '01700000000' }],
    ['find_orders_by_phone', { phone: 'not-a-number' }],
    ['rma_queue', { limit: 5 }],
    ['courier_watch', { limit: 5 }],
    ['abandoned_carts', { limit: 3 }],
    ['list_taxonomy', {}],
    ...(f.productSlug
      ? ([
          ['get_product', { ref: f.productSlug }],
          ['inventory_history', { productRef: f.productSlug, limit: 5 }],
        ] as Array<[string, Record<string, unknown>]>)
      : []),
    ['get_order', { ref: f.invoice ?? '__missing__' }],
    ['get_customer', { ref: f.customerId ?? '__missing__' }],
    ['get_product', { ref: '__missing__' }],
  ]
}

function preview(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content
  const text = content?.[0]?.text ?? ''
  return text.length > 400 ? `${text.slice(0, 400)}…` : text
}

async function run(): Promise<void> {
  const store = await storeId()
  console.log(`store: ${store}\n`)

  const cases = buildCases(await fixtures(store))
  const covered = new Set(cases.map(([name]) => name))
  const uncovered = Object.keys(registry).filter((name) => !covered.has(name))

  let failed = 0
  if (uncovered.length > 0) {
    console.error(`✗ no smoke case for: ${uncovered.join(', ')}`)
    failed += 1
  }

  for (const [name, args] of cases) {
    const tool = registry[name]
    if (!tool) {
      console.error(`✗ ${name}: not registered`)
      failed += 1
      continue
    }
    try {
      const result = await tool.handler(args, {})
      console.log(`✓ ${name}\n${preview(result)}\n`)
    } catch (error) {
      failed += 1
      console.error(`✗ ${name}: ${error instanceof Error ? error.stack : String(error)}\n`)
    }
  }

  // The read-only proxy is the only thing standing between this server and
  // production data, so assert it actually refuses a write.
  try {
    await (prisma().product as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany(
      {},
    )
    console.error('✗ read-only guard: product.deleteMany was NOT blocked')
    failed += 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('refused a write operation')) {
      console.log('✓ read-only guard blocks product.deleteMany')
    } else {
      console.error(`✗ read-only guard: unexpected error — ${message}`)
      failed += 1
    }
  }

  await prisma().$disconnect()
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nall checks passed')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
