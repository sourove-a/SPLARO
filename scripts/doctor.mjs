#!/usr/bin/env node
/**
 * SPLARO Doctor — validates project health
 * Run: pnpm doctor
 */
import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const REQUIRED_ENV = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
]

const REQUIRED_FILES = [
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/layout.tsx',
  'apps/admin/src/app/layout.tsx',
  'apps/api/src/main.ts',
  'packages/database/prisma/schema.prisma',
  '.env',
  'apps/web/postcss.config.mjs',
  'apps/admin/postcss.config.mjs',
]

let passed = 0
let failed = 0

function check(label, fn) {
  try {
    fn()
    console.log(`  ✅ ${label}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`)
    failed++
  }
}

function run(args, opts = {}) {
  const [cmd, ...rest] = args
  const result = spawnSync(cmd, rest, { cwd: ROOT, stdio: 'pipe', timeout: opts.timeout ?? 120000 })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim() ?? ''
    const stdout = result.stdout?.toString().trim() ?? ''
    throw new Error(stderr || stdout || `exit ${result.status}`)
  }
  return result.stdout?.toString().trim() ?? ''
}

console.log('\n🔍 SPLARO Doctor\n')

// 1. Required files
console.log('📁 Required Files:')
for (const f of REQUIRED_FILES) {
  check(f, () => {
    if (!existsSync(resolve(ROOT, f))) throw new Error('Missing')
  })
}

// 2. Environment variables
console.log('\n🔑 Environment Variables:')
const envPath = resolve(ROOT, '.env')
const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
for (const key of REQUIRED_ENV) {
  check(key, () => {
    const inEnv = envContent.includes(`${key}=`) || process.env[key]
    if (!inEnv) throw new Error('Not set')
  })
}

// 3. Dependencies
console.log('\n📦 Dependencies:')
check('pnpm available', () => run(['pnpm', '--version']))
check('node_modules exist (root)', () => {
  if (!existsSync(resolve(ROOT, 'node_modules'))) throw new Error('Run pnpm install')
})
check('web node_modules', () => {
  if (!existsSync(resolve(ROOT, 'apps/web/node_modules'))) throw new Error('Run pnpm install')
})

// 4. API safety rails
console.log('\n🛡️ API safety:')
check('API uses ts-node-dev (not tsx)', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'apps/api/package.json'), 'utf8'))
  const dev = pkg.scripts?.dev ?? ''
  if (dev.includes('tsx watch') || dev.includes('tsx src')) {
    throw new Error('dev script must use ts-node-dev')
  }
  const apiDev = readFileSync(resolve(ROOT, 'scripts/api-dev.mjs'), 'utf8')
  const usesTsNodeDev =
    dev.includes('ts-node-dev') ||
    (dev.includes('api-dev.mjs') && apiDev.includes('ts-node-dev'))
  if (!usesTsNodeDev) throw new Error('dev must use ts-node-dev via api-dev.mjs')
})
check('reflect-metadata in API main', () => {
  const main = readFileSync(resolve(ROOT, 'apps/api/src/main.ts'), 'utf8')
  if (!main.includes('reflect-metadata')) throw new Error('Missing reflect-metadata import')
})
check('API preflight script', () => {
  run(['node', 'scripts/api-preflight.mjs'], { timeout: 15000 })
})

// 5. CSS pipeline
console.log('\n🎨 CSS pipeline:')
check('Tailwind + PostCSS + globals', () => {
  run(['node', 'scripts/verify-css.mjs'], { timeout: 15000 })
})

// 6. TypeScript
console.log('\n🔎 TypeScript:')
check('No TS errors in web', () => {
  run(['pnpm', '--filter', '@splaro/web', 'type-check'], { timeout: 90000 })
})
check('No TS errors in admin', () => {
  run(['pnpm', '--filter', '@splaro/admin', 'type-check'], { timeout: 90000 })
})
check('No TS errors in api', () => {
  run(['pnpm', '--filter', '@splaro/api', 'type-check'], { timeout: 90000 })
})

// 7. Lint
console.log('\n🧹 Lint:')
check('No lint errors in web', () => {
  run(['pnpm', '--filter', '@splaro/web', 'lint'], { timeout: 90000 })
})
check('No lint errors in admin', () => {
  run(['pnpm', '--filter', '@splaro/admin', 'lint'], { timeout: 90000 })
})

// Summary
console.log(`\n${'─'.repeat(40)}`)
console.log(`  Passed: ${passed}   Failed: ${failed}`)
if (failed === 0) {
  console.log('  🎉 All checks passed — project is healthy!\n')
} else {
  console.log('  ⚠️  Fix the issues above before deploying.\n')
  process.exit(1)
}
