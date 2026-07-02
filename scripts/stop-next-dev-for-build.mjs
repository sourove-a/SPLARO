#!/usr/bin/env node
/**
 * Stop next dev on a port before `next build`.
 * Running build while next dev is active corrupts .next (Cannot find module './899.js').
 */
import { getListeningPids, reclaimPort } from './api-port.mjs'

const port = Number(process.argv[2])
if (!port) {
  console.error('Usage: node scripts/stop-next-dev-for-build.mjs <port>')
  process.exit(1)
}

if (!getListeningPids(port).length) process.exit(0)

console.log(`\n⚠️  Stopping next dev on :${port} before production build`)
await reclaimPort(port, { force: true })
