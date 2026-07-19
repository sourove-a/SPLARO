#!/usr/bin/env node
/**
 * Start API first, wait until healthy, then admin + web.
 * Avoids the "admin up before API" race that causes offline spam.
 */
import { spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { cliSpawnOpts, killProcessTree, loopbackUrl, spawnCli } from './spawn-utils.mjs'
import { checkApiHealth, cleanupOrphanApiProcesses, getApiPort, getNextDevPorts, reclaimNextDevPorts, reclaimPort, waitForPortFree } from './api-port.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = getApiPort()
const base = (process.env.API_URL ?? loopbackUrl(port)).replace(/\/+$/, '')
const health = base.endsWith('/api/v1') ? `${base}/health` : `${base}/api/v1/health`

const children = []

function run(cmd, args, opts = {}) {
  const child = spawnCli(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...opts.env },
  })
  children.push(child)
  return child
}

async function waitForApi(maxMs = 90_000) {
  const start = Date.now()
  process.stdout.write(`⏳ Waiting for API ${health} …\n`)
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(health, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
      if (res.ok) {
        console.log(`✅ API ready on :${port}\n`)
        return true
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  console.error(`\n❌ API did not start within ${maxMs / 1000}s. Check apps/api logs.\n`)
  return false
}

function shutdown(code = 0) {
  for (const child of children) {
    killProcessTree(child, 'SIGTERM')
  }
  setTimeout(() => {
    for (const child of children) {
      killProcessTree(child, 'SIGKILL')
    }
    process.exit(code)
  }, 400)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('\n🚀 SPLARO dev stack — API → Admin → Web\n')

cleanupOrphanApiProcesses(port)

console.log('📦 Ensuring Redis…')
spawnSync('corepack', ['pnpm', 'infra:redis'], { cwd: ROOT, stdio: 'inherit', ...cliSpawnOpts() })

run('node', ['scripts/api-preflight.mjs'])

let api = null
const alreadyHealthy = await checkApiHealth(port)
if (alreadyHealthy) {
  console.log(`✅ API already running on :${port} — reusing existing instance\n`)
} else {
  await reclaimPort(port)
  api = run('corepack', ['pnpm', '--filter', '@splaro/api', 'dev'])
  const ready = await waitForApi()
  if (!ready) {
    shutdown(1)
  }
}

console.log('🔍 Stopping stale Next dev before cache reset…')
await reclaimNextDevPorts()
for (const port of getNextDevPorts()) {
  await waitForPortFree(port, 3000)
}

console.log('🔍 Fresh Next.js caches for dev stack…')
run('node', ['scripts/ensure-next-cache.mjs', '--fresh', '--ports-cleared'])

run('corepack', ['pnpm', '--dir', 'apps/admin', 'run', 'dev'])
run('corepack', ['pnpm', '--dir', 'apps/web', 'run', 'dev'])

api?.on('exit', (code) => {
  if (code && code !== 0) shutdown(code)
})
