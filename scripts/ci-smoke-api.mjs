#!/usr/bin/env node
/**
 * API smoke test — used by GitHub Actions and ci-verify.mjs
 */
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { reclaimPort, waitForPortFree } from './api-port.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = resolve(ROOT, 'apps/api')
const port = Number(process.env.API_PORT ?? 4000)

const env = {
  ...process.env,
  CI: 'true',
  JWT_SECRET: process.env.JWT_SECRET ?? 'ci-jwt-secret-min-32-characters-long',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'ci-refresh-secret-min-32-characters',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? 'ci-encryption-key-min-32-characters-long',
  INTERNAL_HEALTH_SECRET:
    process.env.INTERNAL_HEALTH_SECRET ?? 'ci-internal-health-secret-min-16-chars',
  API_PORT: String(port),
  REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/splaro_db',
}

function fail(msg, stderr = '') {
  console.error(`\n❌ API smoke: ${msg}`)
  if (stderr) console.error(stderr.slice(-4000))
  process.exit(1)
}

await reclaimPort(port, { force: true })
await waitForPortFree(port, 10_000)

console.log(`▶ Starting API on :${port}`)
const child = spawn('node', ['dist/main.js'], {
  cwd: API_DIR,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})

let stderr = ''
child.stderr?.on('data', (chunk) => {
  const text = chunk.toString()
  stderr += text
  if (text.includes('ERROR') || text.includes('Bootstrap failed')) {
    process.stderr.write(text)
  }
})

let healthOk = false
const deadline = Date.now() + 90_000

while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 2000))
  if (child.exitCode !== null) {
    fail(`API exited with code ${child.exitCode}`, stderr)
  }
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const body = await res.text()
      if (body.includes('"status":"ok"') || body.includes('"status": "ok"')) {
        healthOk = true
        break
      }
    }
  } catch {
    /* retry */
  }
}

if (!healthOk) fail('Timed out waiting for /api/v1/health', stderr)

console.log('✅ /api/v1/health')

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/health/full`, {
    signal: AbortSignal.timeout(20_000),
  })
  const body = await res.text()
  if (!res.ok) fail(`health/full HTTP ${res.status}: ${body.slice(0, 500)}`, stderr)
  if (!body.includes('postgresql') || !body.includes('healthy')) {
    fail(`health/full unexpected body: ${body.slice(0, 500)}`, stderr)
  }
} catch (err) {
  fail(err instanceof Error ? err.message : 'health/full fetch failed', stderr)
}

console.log('✅ /api/v1/health/full')

try {
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  })
  const location = res.headers.get('location') ?? ''
  if (res.status !== 302 || !location.includes('/api/v1')) {
    fail(`API root / expected 302 → /api/v1, got ${res.status} location=${location}`, stderr)
  }
} catch (err) {
  fail(err instanceof Error ? err.message : 'API root redirect check failed', stderr)
}

console.log('✅ API root redirect')

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/health/routes?storeId=splaro`, {
    signal: AbortSignal.timeout(120_000),
  })
  const body = await res.text()
  if (!res.ok) fail(`health/routes HTTP ${res.status}: ${body.slice(0, 500)}`, stderr)
  const data = JSON.parse(body)
  const { total = 0, healthy = 0, down = 0 } = data.summary ?? {}
  const auth401 = (data.checks ?? []).filter(
    (c) => c.status !== 'healthy' && String(c.message ?? '').includes('401'),
  ).length
  if (auth401 > 0) {
    fail(`${auth401} route probes returned 401 — fix INTERNAL_HEALTH_SECRET bypass`, stderr)
  }
  if (down > 0 || (total > 0 && healthy / total < 0.95)) {
    fail(`health/routes regression: ${healthy}/${total} healthy, ${down} down`, stderr)
  }
} catch (err) {
  fail(err instanceof Error ? err.message : 'health/routes check failed', stderr)
}

console.log('✅ /api/v1/health/routes (≥95% healthy, no 401 storm)')

try {
  process.kill(-child.pid, 'SIGTERM')
} catch {
  try {
    child.kill('SIGTERM')
  } catch {
    /* done */
  }
}

console.log('✅ API smoke passed')
