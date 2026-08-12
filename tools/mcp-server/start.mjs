#!/usr/bin/env node
/**
 * MCP entry for Cursor/Claude (stdio) and VPS HTTP (MCP_TRANSPORT=sse|http).
 * Node 22+ uses native type stripping; Node 20 uses tsx (VPS is currently 20.x).
 */
const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
if (!Number.isFinite(major) || major < 20) {
  process.stderr.write(
    `[splaro-mcp] Node 20+ required (got ${process.version})\n`,
  )
  process.exit(1)
}

if (major < 22) {
  await import('tsx/esm')
}

await import('./src/index.ts')
