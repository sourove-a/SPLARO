#!/usr/bin/env node
/**
 * Local CI mirror — same steps as .github/workflows/ci.yml
 * Usage: pnpm ci:verify
 */
import { spawn, spawnSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { reclaimPort, waitForPortFree } from './api-port.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CI_ENV = {
  ...process.env,
  CI: 'true',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/splaro_db',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
  REDIS_ENABLED: process.env.REDIS_ENABLED ?? 'true',
  JWT_SECRET: process.env.JWT_SECRET ?? 'ci-jwt-secret-min-32-characters-long',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'ci-refresh-secret-min-32-characters',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000',
  NEXT_PUBLIC_STORE_ID: process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro',
  API_PORT: process.env.API_PORT ?? '4000',
}

function run(cmd, args, opts = {}) {
  const label = opts.label ?? `${cmd} ${args.join(' ')}`
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    env: opts.env ?? CI_ENV,
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) {
    console.error(`\n❌ Failed: ${label}`)
    process.exit(result.status ?? 1)
  }
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    console.error(`\n❌ Missing artifact: ${label} (${path})`)
    process.exit(1)
  }
  console.log(`✅ ${label}`)
}

function assertGlobDir(dir, pattern, label) {
  if (!existsSync(dir)) {
    console.error(`\n❌ Missing artifact dir: ${label} (${dir})`)
    process.exit(1)
  }
  const files = readdirSync(dir).filter((f) => pattern.test(f))
  if (!files.length) {
    console.error(`\n❌ No files matching ${pattern} in ${dir}`)
    process.exit(1)
  }
  console.log(`✅ ${label} (${files.length} file(s))`)
}

async function smokeTestApi() {
  console.log('\n▶ API smoke test')
  const apiDir = resolve(ROOT, 'apps/api')
  const port = Number(CI_ENV.API_PORT)

  await reclaimPort(port, { force: true })
  await waitForPortFree(port, 8000)

  const child = spawn('node', ['dist/main.js'], {
    cwd: apiDir,
    env: CI_ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })

  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const deadline = Date.now() + 30_000
  let healthOk = false
  let routesOk = false

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (health.ok) {
        const body = await health.text()
        if (body.includes('ok')) healthOk = true
      }
      const routes = await fetch(
        `http://127.0.0.1:${port}/api/v1/health/routes?storeId=splaro`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (routes.ok) {
        const body = await routes.text()
        if (body.includes('healthy')) routesOk = true
      }
      if (healthOk && routesOk) break
    } catch {
      /* retry */
    }
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* already dead */
    }
  }

  if (!healthOk) {
    console.error('❌ API health check failed')
    if (stderr) console.error(stderr.slice(-2000))
    process.exit(1)
  }
  console.log('✅ API /health')

  if (!routesOk) {
    console.error('❌ API /health/routes check failed')
    if (stderr) console.error(stderr.slice(-2000))
    process.exit(1)
  }
  console.log('✅ API /health/routes')
}

console.log('═══ SPLARO CI verify (local) ═══')

run('pnpm', ['install', '--frozen-lockfile'])
run('node', ['scripts/verify-css.mjs'], { env: process.env })
run('pnpm', ['type-check'])
run('pnpm', ['--filter', '@splaro/web', 'lint'])
run('bash', ['-lc', 'cd packages/database && npx prisma db push'], {
  label: 'prisma db push',
})
run('pnpm', ['build'])

assertFile(resolve(ROOT, 'packages/types/dist/index.js'), 'packages/types/dist')
assertFile(resolve(ROOT, 'packages/config/dist/index.js'), 'packages/config/dist')
assertFile(resolve(ROOT, 'apps/api/dist/main.js'), 'apps/api/dist/main.js')
assertGlobDir(resolve(ROOT, 'apps/web/.next/static/css'), /\.css$/, 'web CSS artifacts')
assertGlobDir(resolve(ROOT, 'apps/admin/.next/static/css'), /\.css$/, 'admin CSS artifacts')

run('node', ['scripts/api-preflight.mjs'], { label: 'api preflight' })
await smokeTestApi()

console.log('\n═══ CI verify passed ═══\n')
