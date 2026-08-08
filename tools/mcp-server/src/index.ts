#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { log } from './env.ts'
import { prisma, storeId } from './prisma.ts'
import { registerAnalyticsTools } from './tools/analytics.ts'
import { registerCatalogTools } from './tools/catalog.ts'
import { registerOperationsTools } from './tools/operations.ts'
import { registerOrderTools } from './tools/orders.ts'

const server = new McpServer(
  { name: 'splaro', version: '1.0.0' },
  {
    instructions:
      'Read-only access to the SPLARO store database (catalog, orders, customers, sales). ' +
      'All amounts are BDT and all day boundaries are Asia/Dhaka. ' +
      'Start with store_overview for broad questions, then drill in with the specific tools. ' +
      'This server cannot change anything — for edits, use the admin panel.',
  },
)

registerCatalogTools(server)
registerOrderTools(server)
registerOperationsTools(server)
registerAnalyticsTools(server)

async function main(): Promise<void> {
  // Fail loudly at startup rather than on the first tool call, so a bad
  // DATABASE_URL shows up as a connection error in the client instead of a
  // confusing mid-conversation failure.
  await storeId()

  const transport = new StdioServerTransport()
  await server.connect(transport)
  log('ready on stdio (read-only)')
}

async function shutdown(): Promise<void> {
  await prisma().$disconnect().catch(() => {})
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((error: unknown) => {
  log(`fatal: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
