#!/usr/bin/env node
/**
 * Stdio entry for Cursor / Claude Code.
 * Node 22+ is required so TypeScript sources run via type stripping.
 * No HTTP listener. Read-only server lives in src/index.ts.
 */
const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
if (!Number.isFinite(major) || major < 22) {
  process.stderr.write(
    `[splaro-mcp] Node 22+ required for TypeScript type stripping (got ${process.version})\n`,
  )
  process.exit(1)
}

await import('./src/index.ts')
