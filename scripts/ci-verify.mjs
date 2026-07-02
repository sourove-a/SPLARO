#!/usr/bin/env node
/**
 * Local CI mirror — same steps as .github/workflows/ci.yml
 * Usage: pnpm ci:verify
 */
import { spawnSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

run('node', ['scripts/ci-smoke-api.mjs'], { label: 'API smoke test' })

console.log('\n═══ CI verify passed ═══\n')
