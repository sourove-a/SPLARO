#!/usr/bin/env node
/**
 * Gate before Hostinger git push — catches CI + production-env issues locally.
 * Usage: pnpm predeploy  |  pnpm deploy:hostinger (runs this automatically)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROD_ENV = resolve(ROOT, 'infrastructure/hostinger/.env.splaro.co.production')

function run(cmd, args, opts = {}) {
  const label = opts.label ?? `${cmd} ${args.join(' ')}`
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    env: opts.env ?? process.env,
    stdio: 'inherit',
    ...cliSpawnOpts(),
  })
  if (result.status !== 0) {
    console.error(`\n❌ Pre-deploy blocked: ${label}`)
    process.exit(result.status ?? 1)
  }
}

console.log('═══ SPLARO pre-deploy (Hostinger push gate) ═══')

run('node', ['scripts/pre-push.mjs'], { label: 'pre-push (type-check + lint + CSS)' })

if (existsSync(PROD_ENV)) {
  run('node', ['scripts/validate-production-env.mjs'], {
    label: 'production env (hPanel template)',
    env: {
      ...process.env,
      FORCE_PRODUCTION_ENV_CHECK: '1',
      SPLARO_ENV_FILE: PROD_ENV,
    },
  })
} else {
  console.log('\n⚠️  Skip production env check — missing infrastructure/hostinger/.env.splaro.co.production')
}

if (process.env.SPLARO_PREDEPLOY_BUILD === '1') {
  run('pnpm', ['--filter', '@splaro/web', 'build'], {
    label: 'web production build (SPLARO_PREDEPLOY_BUILD=1)',
    env: { ...process.env, CI: '1' },
  })
}

console.log('\n✅ Pre-deploy OK — safe to push (Hostinger will build on hPanel)\n')
