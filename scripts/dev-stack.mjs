#!/usr/bin/env node
/**
 * Start API first, wait until healthy, then admin + web.
 * Avoids the "admin up before API" race that causes offline spam.
 */
import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.API_PORT ?? process.env.PORT_API ?? 4000)
const base = (process.env.API_URL ?? `http://localhost:${port}`).replace(/\/+$/, '')
const health = base.endsWith('/api/v1') ? `${base}/health` : `${base}/api/v1/health`

const children = []

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
    shell: process.platform === 'win32',
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
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 300)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('\n🚀 SPLARO dev stack — API → Admin → Web\n')

run('node', ['scripts/api-preflight.mjs'])

const api = run('pnpm', ['--filter', '@splaro/api', 'dev'])

const ready = await waitForApi()
if (!ready) {
  shutdown(1)
}

run('pnpm', ['exec', 'turbo', 'run', 'dev', '--parallel', '--filter=@splaro/admin', '--filter=@splaro/web'])

api.on('exit', (code) => {
  if (code && code !== 0) shutdown(code)
})
