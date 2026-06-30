#!/usr/bin/env node
/**
 * Warn when admin/web starts but Nest API is not listening on :4000.
 * Non-blocking — always exit 0.
 */
import { spawnSync } from 'child_process'

const port = Number(process.env.API_PORT ?? process.env.PORT_API ?? 4000)
const base = (process.env.API_URL ?? `http://localhost:${port}`).replace(/\/+$/, '')
const health = base.endsWith('/api/v1') ? `${base}/health` : `${base}/api/v1/health`

async function ping() {
  try {
    const res = await fetch(health, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

function isPortListening() {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0 && result.stdout.includes(`:${port}`)
}

const ok = await ping()
if (ok) {
  console.log(`✅ API live on :${port}`)
} else if (isPortListening()) {
  console.warn(`
⚠️  SPLARO API port ${port} is listening, but health check did not respond.
   API may be starting, blocked by local sandbox networking, or waiting on database.

   If admin data is empty:
     brew services start postgresql@16
     pnpm db:push
     pnpm db:seed
`)
} else {
  console.warn(`
⚠️  SPLARO API is NOT running on port ${port}
   Admin will show "API offline" and dashboard data will be empty.

   Fix (recommended — one terminal):
     pnpm dev:stack

   Or start API separately:
     pnpm dev:api
`)
}
