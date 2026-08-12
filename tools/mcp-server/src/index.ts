#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHash } from 'node:crypto'
import { log } from './env.ts'
import { prisma, storeId } from './prisma.ts'
import { startHttpServer } from './server-http.ts'
import { createSplaroMcpServer } from './create-server.ts'
import { setStdioAuthFallback } from './auth-context.ts'

async function main(): Promise<void> {
  const transportMode = process.env.MCP_TRANSPORT ?? 'stdio'

  if (transportMode === 'sse' || transportMode === 'http') {
    const port = Number.parseInt(process.env.MCP_PORT ?? '4005', 10)
    // Bind HTTP first so /health works even while DB warms (deploy probes).
    await startHttpServer(port)
    void storeId()
      .then(() => log('store resolved for HTTP tools'))
      .catch((err: unknown) => {
        log(`store resolve failed (tools will error until DB is up): ${err instanceof Error ? err.message : String(err)}`)
      })
    return
  }

  await storeId()

  // Local Cursor / Claude Desktop — process-level auth for Nest writes.
  const stdioToken =
    process.env['MCP_API_KEY']?.trim() || process.env['SPLARO_MCP_SERVICE_TOKEN']?.trim() || ''
  setStdioAuthFallback({
    token: stdioToken,
    ...(stdioToken
      ? { tokenHash: createHash('sha256').update(stdioToken).digest('hex') }
      : {}),
    storeId: process.env['SPLARO_MCP_STORE_ID']?.trim() || null,
    scopes: ['mcp:read', 'mcp:write', '*'],
    source: 'stdio',
  })

  const server = createSplaroMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  log('ready on stdio (read/write & intelligence enabled)')
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
